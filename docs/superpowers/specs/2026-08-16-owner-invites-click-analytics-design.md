# saar.to — owner invites and click analytics

Date: 2026-08-16

## Goal

saar.to is a personal shortener. The public cannot create accounts. The owner account is created only by a CLI script. The owner can issue one-time invite links so other people can register. Click tracking stores every hit in enough detail to inspect individual visits, unique visitors, and per-link breakdowns.

## Access

### Roles

- `owner` — created only by `npm run create-user`. Sees every short URL and every click event.
- `member` — created only by accepting a valid invite. Sees and manages only their own short URLs and those URLs’ clicks.

JWT/session includes `id` and `role`. `requireUserId()` stays; add `requireOwner()` for invite management. List/get URL queries: owner uses no `userId` filter; members filter by `userId`.

### Bootstrap

If the users collection is empty, the only way in is:

```bash
npm run create-user -- --name "Owner" --email you@example.com --password '…'
```

`create-user` always creates `role: "owner"`. Running it again creates another owner (backup account). Members are never created by the script. There is no web UI to promote or create owners.

### Public signup

- Header “Create account” is removed. Signed-out users only see Sign in.
- `GET /register` without a valid `invite` query param redirects to `/login`.
- `POST /api/register` without a valid invite token returns 403.
- Existing `/register` form stays, but only works with `?invite=`.

### Invites

Owner-only, from the signed-in dashboard (not a public page):

- Button: “Invite” → creates an invite and copies `https://saar.to/register?invite=<token>`.
- Invite document: `{ token, createdBy, role: "member", expiresAt, usedAt, createdAt }`.
- Token: 24+ chars, URL-safe, unique.
- Expires 7 days after creation. One-time: `usedAt` set on successful register; reused tokens fail.
- Expired or used invites: register API returns 400 with a generic “Invite is invalid or expired”.
- Owner can list outstanding invites and revoke (delete or set `usedAt`) from the same dashboard control, kept small: a dialog with copy + pending list.

Members cannot create invites.

### Out of scope (access)

- Password reset, email sending, OAuth.
- Changing a member into an owner from the UI.
- Shared link pools.

## Click events

Each successful public redirect (`GET /{code}` for a non-expired link) inserts one `ClickEvent` and still increments `ShortUrl.clicks` / `lastAccessedAt`. The handler awaits the write; if the event insert fails, it logs and still redirects. Missing or expired codes do not record a click.

### Fields stored

| Field                                                        | Source                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `shortUrlId`                                                 | link `_id`                                                                                                               |
| `userId`                                                     | link owner (denormalized)                                                                                                |
| `short`                                                      | slug (denormalized)                                                                                                      |
| `createdAt`                                                  | server time                                                                                                              |
| `ip`                                                         | `x-forwarded-for` (first hop), else `x-real-ip`, else socket                                                             |
| `userAgent`                                                  | `user-agent` header, raw                                                                                                 |
| `referrer`                                                   | `referer` header, raw (may be empty)                                                                                     |
| `acceptLanguage`                                             | `accept-language` header                                                                                                 |
| `country`, `region`, `city`                                  | `x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city`, or `cf-ipcountry` when present; otherwise empty |
| `browser`, `browserVersion`, `os`, `osVersion`, `deviceType` | parsed from UA (`ua-parser-js`)                                                                                          |
| `isBot`                                                      | UA parser `bot` / known crawler family                                                                                   |
| `visitorKey`                                                 | `sha256(ip + "\n" + userAgent)` hex, first 32 chars                                                                      |

Do not store cookies or request bodies. Truncate oversized headers (UA/referrer/language) to 1k chars.

Existing `dailyClicks` on `ShortUrl` are no longer updated. They remain on documents as a fallback so pre-change days still chart. New days come from `ClickEvent` counts.

### Unique visitors

A unique visitor for a query is a distinct `visitorKey`. Dashboard “Unique visitors” is all-time distinct keys in the visible set of links (all links for owner, own links for member), honoring the Hide bots filter. Per-link uniques are distinct keys for that `shortUrlId`.

## Stats UI

### Home dashboard

Totals only (no country/device/top-link strip):

- Links
- Clicks
- Unique visitors
- Active

Table filters (All / Active / Expired) stay. Expired is not a headline card.

Hide bots toggle on the dashboard applies to unique-visitor and click totals derived from events. `ShortUrl.clicks` is the stored total including bots; when Hide bots is on, clicks and uniques are counted from events with `isBot: false`. When Hide bots is off, clicks use `ShortUrl.clicks` (includes history from before events existed). Uniques always come from events.

### Per-link stats (`/stats/[code]`)

Owner may open any code; members only their own (404 otherwise).

- Headline: slug, destination, active/expired, created, last access, expires.
- Cards: clicks, unique visitors (respect Hide bots).
- Hide bots toggle (default: show all, including bots).
- Daily chart: last 14 UTC days. Use ClickEvent counts for a day if any events exist that day; otherwise use the legacy `dailyClicks` bucket. Hide bots: event days count `isBot: false` only; legacy days cannot exclude bots and are shown as stored.
- Breakdowns (from events, Hide bots applied): country, referrer host, device type, browser. Counts + simple bar or table. Empty referrer → “(direct)”. Empty country → “(unknown)”.
- Recent hits table (newest first, 50): time, country/city, device, browser, referrer host, IP, bot badge.

### Out of scope (stats)

- Hourly charts, maps, CSV export, realtime websockets.
- Audit log of dashboard actions (create/copy/delete).
- Fingerprinting cookies.

## API

- `POST /api/invites` — owner; creates invite; returns `{ url, expiresAt }`.
- `GET /api/invites` — owner; pending (unused, unexpired) invites.
- `DELETE /api/invites/[id]` — owner; revoke.
- `POST /api/register` — body adds `invite: string`; validates token. Missing invite → 403; invalid/expired/used → 400.
- `GET /api/urls` — owner: all; member: own. DTO unchanged (no per-row uniques).
- `GET /api/stats/overview?excludeBots=true|false` — `{ links, clicks, uniqueVisitors, active }` for the caller’s visible set.
- `GET /api/urls/[id]` — current DTO; owner may fetch any id, member only owned.
- `GET /api/urls/[id]/clicks?excludeBots=true|false` — `{ uniqueVisitors, daily: [{ date, count }], breakdowns: { country, referrer, device, browser }, recent: ClickEventDto[] }`. Daily merge with legacy buckets happens server-side.

Public `GET /{code}` unchanged besides recording the event.

`proxy.ts`: protect `/api/invites` and `/api/stats` like `/api/urls`. `/register` stays public (invite-gated in the route).

## Error handling

- Invalid/expired/used invite: 400, no user created.
- Non-owner hitting invite APIs: 403.
- Member fetching another user’s stats: 404 (do not leak existence).
- Click insert failure: log and still redirect (availability over perfect stats). Do not fail the short link.

## Files (expected)

- `scripts/create-user.ts` + `package.json` script `create-user`
- `lib/models/user.ts` — add `role`
- `lib/models/invite.ts`
- `lib/models/click-event.ts`
- `lib/clicks.ts` — parse request, visitorKey, recordClickEvent
- `lib/invites.ts` — create/consume/list
- `app/api/invites/route.ts`, `app/api/invites/[id]/route.ts`
- `app/api/stats/overview/route.ts`
- `app/api/urls/[id]/clicks/route.ts`
- `app/[code]/route.ts` — record event
- `app/register/page.tsx` — require invite param
- `components/invite-dialog.tsx`, dashboard/stats UI updates
- Existing users with no `role`: on `create-user` (and once at process start in `connectDB` if any document is missing `role`), set the oldest user to `owner` and everyone else to `member`.

## Testing (manual)

1. Empty DB: `/register` redirects; `create-user` makes owner; login works.
2. Owner Invite copies a URL; opening it registers a member; second use fails; after 7 days fails (unit-test expiry, don’t wait).
3. Member cannot call invite APIs; cannot open owner’s `/stats/code`.
4. Click `/{code}` from a browser: event has IP and UA; stats recent table updates; Hide bots hides a curl/Googlebot-style UA if classified as bot.
5. Owner dashboard uniques include member-owned links; member dashboard does not.
