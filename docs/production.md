# Production hosting — saar.to

Decision date: 2026-08-16

## Decision

| Layer    | Choice                                               | Tier                   |
| -------- | ---------------------------------------------------- | ---------------------- |
| App      | [Vercel](https://vercel.com)                         | Hobby (free)           |
| Database | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | M0 free cluster        |
| Domain   | `saar.to`                                            | Registrar DNS → Vercel |

This is the default free stack for a personal Next.js App Router app with MongoDB and a custom domain. Alternatives (Railway, Render, Fly, self-hosted VPS) add ops cost without a clear benefit at this scale.

## Why this stack

- Vercel matches Next.js (App Router, server routes, NextAuth, `proxy.ts`).
- Atlas M0 (512 MB) is enough for short links and future click-event history.
- Vercel request geo headers (`x-vercel-ip-country`, region, city) feed planned click analytics.
- Custom domain HTTPS is automatic once DNS points at Vercel.

## Environment variables (production)

Set these in the Vercel project → Settings → Environment Variables (Production):

| Variable                | Production value                                           |
| ----------------------- | ---------------------------------------------------------- |
| `MONGODB_URI`           | Atlas connection string (`mongodb+srv://…`)                |
| `NEXT_PUBLIC_BASE_URL`  | `https://saar.to`                                          |
| `NEXTAUTH_URL`          | `https://saar.to`                                          |
| `NEXTAUTH_SECRET`       | Long random secret (`openssl rand -base64 32`)             |
| `VERCEL_TOKEN`          | (Optional) Token for auto-adding `{slug}.saar.to` domains  |
| `VERCEL_PROJECT_ID`     | (Optional) Project id from `.vercel/project.json`          |
| `VERCEL_TEAM_ID`        | (Optional) Team/org id (`orgId` in `.vercel/project.json`) |
| `BLOB_READ_WRITE_TOKEN` | (Optional) Vercel Blob store token for file-link uploads   |

Local `.env.local` may use `NEXTAUTH_URL=http://localhost:3000` and a local or Atlas URI. Never commit secrets.

## Preview deployments

Vercel creates a **Preview** deployment for every push to a non-production branch (and for pull requests).

| Variable               | Preview recommendation                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`          | Same Atlas cluster, or a separate `url-shortener-preview` DB                                                     |
| `NEXTAUTH_SECRET`      | Same as production (or a dedicated preview secret)                                                               |
| `NEXTAUTH_URL`         | Leave **unset** — the app uses `VERCEL_URL` automatically                                                        |
| `NEXT_PUBLIC_BASE_URL` | Leave **unset** on Preview so invite/short links use the preview host; keep `https://saar.to` on Production only |

Production branch is `master`. Push a feature branch to get a URL like `https://saar-to-git-<branch>-….vercel.app`.

```bash
git push -u origin HEAD
# then open the Preview URL from the Vercel dashboard or GitHub check
```

## Atlas checklist

1. Create a free **M0** cluster (region near you or near Vercel).
2. Create a database user with a strong password.
3. Network Access: allow `0.0.0.0/0` for Hobby deploys, or restrict later.
4. Put `/url-shortener` in the URI path (`mongodb+srv://…mongodb.net/url-shortener`). A missing path makes Mongoose use the `test` database.
5. Copy the `mongodb+srv://…` URI into Vercel as `MONGODB_URI`.

## Vercel checklist

1. Import this GitHub repo into a Vercel project (Framework: Next.js).
2. Set Production env vars as above. For Preview, set `MONGODB_URI` and `NEXTAUTH_SECRET`; leave `NEXTAUTH_URL` / `NEXT_PUBLIC_BASE_URL` unset (see Preview deployments).
3. Deploy from `main` (or your default branch).
4. Project → Domains → add `saar.to` (and `www` if you want a redirect).
5. At the registrar, add the DNS records Vercel shows (usually A/ALIAS/CNAME).
6. Confirm `https://saar.to` loads and `/login` works against Atlas.

## Owner vanity subdomains (`resume.saar.to`)

Hobby does not support a Vercel wildcard custom domain. Per-subdomain hosts are added via the Domains API when an owner creates a premium link.

1. At the registrar, add a one-time **wildcard CNAME**: `*.saar.to` → the same Vercel target as apex (or `cname.vercel-dns.com` as shown in the dashboard).
2. Set `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, and `VERCEL_TEAM_ID` on Production so create/delete can attach/remove `{slug}.saar.to`.
3. Manual fallback: Project → Domains → Add `{slug}.saar.to`.
4. After creating a premium link, open `https://{slug}.saar.to` and confirm it redirects.

## Smoke test after first deploy

1. Pull production env with `npm run env:pull-prod`, then create the owner with `npm run create-user -- --name "Owner" --email you@example.com --password '…' --target production`.
2. Open `https://saar.to/login` and sign in.
3. Create a short link; confirm `https://saar.to/{code}` redirects.
4. Use **Invite** to copy a link; open it in a private window and register a member.
5. Confirm `/register` without `?invite=` redirects to login.

## Local vs production

|                | Local                                                                                                      | Production                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------- |
| App            | `npm run dev` → `http://localhost:3000`                                                                    | Vercel → `https://saar.to` |
| DB             | Local Mongo or Atlas                                                                                       | Atlas M0                   |
| `NEXTAUTH_URL` | `http://localhost:3000`                                                                                    | `https://saar.to`          |
| Short links    | Prefer `NEXT_PUBLIC_BASE_URL=https://saar.to` even locally if you want copied URLs to be production-shaped | `https://saar.to`          |

## Related product work (not required to host)

Owner-only invites and richer click events are specified in
`docs/superpowers/specs/2026-08-16-owner-invites-click-analytics-design.md`.
Ship hosting first; close public signup and deepen analytics when that plan is implemented.

## Ops notes

- Redeploy after env changes (or use Vercel’s “Redeploy”).
- Atlas free tier pauses idle clusters rarely on M0; if the first request is slow after idle, that is normal cold start + DB connect.
- Rotate `NEXTAUTH_SECRET` only if compromised (all sessions invalidate).
