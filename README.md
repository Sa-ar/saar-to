<div align="center">

# saar.to

**A personal, invite-only URL shortener with click analytics — gold on deep violet-black.**

Built with the Next.js App Router, MongoDB/Mongoose, NextAuth, TanStack (Query · Form · Table), and shadcn/ui.

[Live site](https://saar.to) · [Production runbook](docs/production.md)

![saar.to dashboard](docs/media/dashboard.png)

</div>

---

## Table of contents

- [What is saar.to](#what-is-saarto)
- [Demos](#demos)
- [Screenshots](#screenshots)
- [Features](#features)
- [Tech stack](#tech-stack)
- [How it works](#how-it-works)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Routes & API](#routes--api)
- [Access model](#access-model)
- [Reserved paths](#reserved-paths)
- [Deployment](#deployment)
- [Project structure](#project-structure)

---

## What is saar.to

`saar.to` is a small, opinionated URL shortener for a single owner and a handful of invited members. It is **not** an open, public sign-up product — access is invite-only. Every account manages its own links; the owner can see and edit everything. Short-link redirects themselves are public, so `https://saar.to/<code>` works for anyone.

Highlights:

- Create `saar.to/slug` path links, or (for owners) premium `slug.saar.to` subdomain links.
- **Edit** any link's destination, slug, and expiry after the fact.
- Rich per-link analytics: click totals, last access, and a 14-day daily breakdown.
- The app's own routes (`/login`, `/api`, `/stats`, …) can never be claimed as a slug.

---

## Demos

### Create a link and follow the redirect

Sign in, shorten a destination from the modal, and watch `saar.to/<slug>` redirect to the target.

![Create a link and redirect](docs/media/create-redirect.gif)

▶️ [Watch the full-quality recording (MP4)](docs/media/create-redirect.mp4)

### Edit a link & reserved-path protection

Edit an existing link's destination and slug, then try to rename it to a reserved path (`api`) and get blocked inline.

![Edit a link and reserved-path validation](docs/media/edit-reserved.gif)

▶️ [Watch the full-quality recording (MP4)](docs/media/edit-reserved.mp4)

> GitHub renders the animated GIFs inline. Click the MP4 links above for the full-resolution screen recordings.

---

## Screenshots

<table>
  <tr>
    <td width="50%">
      <strong>Dashboard</strong><br/>
      Filterable link table with live stat cards, status badges, and per-row actions.
      <br/><br/>
      <img src="docs/media/dashboard.png" alt="Dashboard" />
    </td>
    <td width="50%">
      <strong>Create link</strong><br/>
      Modal with a live short-URL preview and an optional custom slug / expiry.
      <br/><br/>
      <img src="docs/media/create-link.png" alt="Create link modal" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Edit link</strong><br/>
      Prefilled dialog to change the destination, slug, or expiry of an existing link.
      <br/><br/>
      <img src="docs/media/edit-link.png" alt="Edit link modal" />
    </td>
    <td width="50%">
      <strong>Reserved-path guard</strong><br/>
      Reserved app paths are rejected inline, on both create and edit.
      <br/><br/>
      <img src="docs/media/reserved-slug.png" alt="Reserved slug validation" />
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Per-link stats</strong><br/>
      Click totals, created / last-accessed timestamps, and a 14-day history.
      <br/><br/>
      <img src="docs/media/stats.png" alt="Link stats" />
    </td>
    <td width="50%">
      <strong>Sign in</strong><br/>
      Email + password credentials. Accounts are invite-only.
      <br/><br/>
      <img src="docs/media/login.png" alt="Login page" />
    </td>
  </tr>
</table>

---

## Features

- **Invite-only accounts** — the owner is bootstrapped from the CLI; members join through a one-time invite link that expires in 7 days.
- **Email / password auth** — NextAuth credentials with JWT sessions.
- **Create links from a modal** — paste any `http(s)` URL, optionally set a custom slug and an expiry. Path links become `saar.to/slug`.
- **Edit links** — update destination, slug, or expiry at any time. Changing a slug moves the short URL (the old one starts returning 404). Slug changes are uniqueness-checked.
- **Premium subdomains (owner-only)** — mint `slug.saar.to` vanity links; the app attaches the domain to the Vercel project automatically when a token is configured.
- **Reserved-path protection** — the app's own routes can never be used as a slug, on both create and edit.
- **Click analytics** — total clicks, last-access time, and a rolling 14-day daily bucket per link (bot-safe daily buckets are stored in UTC).
- **Dashboard UX**
  - Live stat cards (Links / Clicks / Active / Expired) that react to the search + status filters.
  - Search by URL or slug and filter by Active / Expired.
  - `Expiring soon` badge for links within 24h of expiry, and an `Expired` badge afterward.
  - Copy-to-clipboard with an inline confirmation state.
  - A "Showing X of Y links" count and friendly empty states.
- **Public redirects** — `saar.to/<code>` redirects for anyone; missing or expired codes return a 404.

---

## Tech stack

| Layer                          | Choice                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| Framework                      | [Next.js 16](https://nextjs.org) App Router (React 19, TypeScript)         |
| Styling                        | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (Base UI primitives)  |
| Data fetching / forms / tables | [TanStack](https://tanstack.com) Query, Form, and Table                    |
| Auth                           | [NextAuth](https://next-auth.js.org) credentials (JWT sessions)            |
| Database                       | [MongoDB](https://www.mongodb.com) with [Mongoose](https://mongoosejs.com) |
| Validation                     | [Zod](https://zod.dev)                                                     |
| Codes                          | [nanoid](https://github.com/ai/nanoid) (7-char auto slugs)                 |
| Hosting                        | Vercel (app) + MongoDB Atlas (database)                                    |

---

## How it works

**Redirects.** Path links resolve through the catch-all route `app/[code]/route.ts`: it rejects reserved paths, looks up the code, 404s if missing/expired, records a click (incrementing the total, the UTC daily bucket, and `lastAccessedAt`), then `307`-redirects to the destination. Premium `slug.saar.to` hosts are rewritten to `app/go/[code]` by `proxy.ts`.

**Auth & routing.** `proxy.ts` (Next.js middleware) protects the dashboard, stats, and `/api/urls` + `/api/invites` routes, redirecting anonymous users to `/login` (or returning `401` for API calls). Vanity subdomains only serve redirects; app paths on a vanity host are bounced back to the apex.

**Data model.** A `ShortUrl` document stores `userId`, `full` (destination), `short` (unique code), `kind` (`path` | `subdomain`), `clicks`, `expiresAt`, `lastAccessedAt`, and a `dailyClicks[]` array (`{ date, count }`, retained ~30 days).

**Validation.** All slug/URL/expiry rules live in `lib/validations/url.ts` as shared Zod helpers used by both create and edit, so the two paths never drift. Reserved slugs are rejected first, then length (3–32), then the character-set pattern.

---

## Getting started

### Prerequisites

- Node.js 24+
- A MongoDB instance (local `mongod`/Docker for development, or Atlas)

### 1. Install & configure

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local` (see [Environment variables](#environment-variables)). Generate a session secret with:

```bash
openssl rand -base64 32
```

### 2. Start MongoDB

Point `MONGODB_URI` at any reachable MongoDB. For a quick local instance with Docker:

```bash
docker run -d --name saar-mongo -p 27017:27017 mongo:8
# then: MONGODB_URI=mongodb://127.0.0.1:27017/url-shortener
```

### 3. Create the first owner

Public `/register` is closed, so bootstrap the owner from the CLI:

```bash
npm run create-user -- --name "Owner" --email you@example.com --password 'your-password'
```

### 4. Run the app

```bash
npm run dev
# http://localhost:3000
```

Sign in at `/login`. From the dashboard, use **Invite** to copy a one-time registration link to share with a member.

---

## Environment variables

| Variable                                                | Purpose                                                 | Local                                     | Production                            |
| ------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| `MONGODB_URI`                                           | MongoDB connection string                               | `mongodb://127.0.0.1:27017/url-shortener` | Atlas `mongodb+srv://…/url-shortener` |
| `NEXT_PUBLIC_BASE_URL`                                  | Public origin used to build short links                 | `http://localhost:3000`                   | `https://saar.to`                     |
| `NEXTAUTH_URL`                                          | App origin NextAuth signs against                       | `http://localhost:3000`                   | `https://saar.to`                     |
| `NEXTAUTH_SECRET`                                       | Secret used to sign sessions                            | any long random string                    | long random secret                    |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` | _(optional)_ auto-attach `slug.saar.to` premium domains | usually unset                             | set to enable premium subdomains      |
| `BLOB_READ_WRITE_TOKEN`                                 | _(optional)_ Vercel Blob uploads for file links         | usually unset                             | set to enable file uploads            |

On Vercel **Preview** deployments, leave `NEXTAUTH_URL` and `NEXT_PUBLIC_BASE_URL` unset so the app uses `VERCEL_URL`. Never commit `.env.local` or secrets.

---

## Scripts

```bash
npm run dev            # development server at http://localhost:3000
npm run build          # production build
npm start              # serve the production build
npm run lint           # Oxlint (type-aware)
npm run format         # Oxfmt
npm run check          # lint + format check
npm run create-user    # create an owner account (see Getting started)
npm run env:pull-prod  # write Vercel production env into .env.prod
```

---

## Routes & API

| Path                 | Method               | Access                     | Description                                |
| -------------------- | -------------------- | -------------------------- | ------------------------------------------ |
| `/login`             | GET                  | public                     | Sign in                                    |
| `/register?invite=…` | GET                  | invite                     | Create a member account (invite required)  |
| `/`                  | GET                  | auth                       | Dashboard: stats, link table, create modal |
| `/stats/[code]`      | GET                  | owner of link (owner: any) | Per-link stats & 14-day history            |
| `/[code]`            | GET                  | public                     | Redirect; 404 if missing or expired        |
| `/api/register`      | POST                 | invite                     | Create a member (valid invite required)    |
| `/api/invites`       | GET · POST           | owner                      | List or create invites                     |
| `/api/invites/[id]`  | DELETE               | owner                      | Revoke an invite                           |
| `/api/urls`          | GET · POST           | auth                       | List your URLs · create a short URL        |
| `/api/urls/[id]`     | GET · PATCH · DELETE | owner of link (owner: any) | Fetch · **edit** · delete a short URL      |

`POST /api/urls` accepts `{ fullUrl, slug?, expiresAt?, kind? }`. `PATCH /api/urls/[id]` accepts `{ fullUrl, slug, expiresAt? }` (the link's `kind` is immutable). `[id]` may be a Mongo id or the short code.

---

## Access model

- **Owner** — bootstrapped via `npm run create-user`. Sees, edits, and deletes **all** links, and can create premium subdomain links and invites.
- **Member** — joins only through a one-time invite link. Sees and manages **only their own** links.
- Public `/register` without a valid `?invite=` redirects to `/login`.

---

## Reserved paths

Short slugs may never shadow the app's own first-path segments (e.g. `login`, `register`, `api`, `stats`, `go`, plus framework paths like `_next`). This is enforced centrally by `isReservedSlug` in `lib/validations/url.ts` and applied to **both** creating and editing links, and the redirect route refuses to resolve reserved codes. Attempting to use one returns a clear `This slug is reserved` error inline in the form and a `400` from the API.

---

## Deployment

Production runs on **Vercel Hobby** with **MongoDB Atlas M0** behind the `saar.to` domain. The full checklist — Atlas setup, Vercel env vars, custom domains, premium subdomains, and post-deploy smoke tests — lives in [docs/production.md](docs/production.md).

| Layer    | Choice                 |
| -------- | ---------------------- |
| App      | Vercel Hobby           |
| Database | MongoDB Atlas M0       |
| Domain   | `saar.to` → Vercel DNS |

Pushes to `master` deploy to production; other branches and PRs get Vercel Preview deployments.

---

## Project structure

```
app/                 # App Router: pages, redirects, and API route handlers
  [code]/            # public path-link redirect
  go/[code]/         # premium subdomain redirect (via proxy rewrite)
  api/               # urls, invites, register, auth endpoints
components/          # dashboard, url table/form, dialogs, shadcn/ui primitives
lib/                 # db, auth, validations, dates/format, urls, hosts, vercel-domains
docs/                # production runbook + README media
scripts/create-user.ts
proxy.ts             # auth + vanity-subdomain middleware
```

---

<div align="center">
<sub>Built with Next.js · MongoDB · TanStack · shadcn/ui — branded as <strong>saar.to</strong>.</sub>
</div>
