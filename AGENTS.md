## Learned User Preferences

- Prefer a Next.js App Router stack with TanStack (Form, Query, Table) and shadcn/ui (including shadcn Chart) when modernizing this shortener.
- Require authenticated multi-user support; treat this as a personal shortener, not an open public signup product.
- Keep the dashboard as the home experience: link statistics with search/status filters, create links on `/new`, and empty states that prompt creating a link.
- Match saar.fyi brand styling: dark violet-black surfaces with gold accent `#F9D026` (exact), and keep the product branded as saar.to.
- Prioritize rich click/visit analytics (per-hit detail, uniques, bot filtering) over minimal click counters alone.
- Prefer explicit loading, error, success, and empty states across dashboard, stats, auth, and invite flows (including route-level loading/error UI).
- Treat the GitHub repo as public: never commit PII, doxxing material, or secrets, including in git history.
- Keep app pages on the same content width as the header; dialogs can stay narrower.
- QR codes should be copyable and downloadable images (not display-only).
- Default cursor for buttons should be pointer.
- Prefer shared const objects over magic string unions (for example `SHORT_URL_KIND` in `lib/kinds.ts`) and enforce that with lint.

## Learned Workspace Facts

- Product domain is `saar.to`; this repo is the personal URL shortener (Next.js + MongoDB/Mongoose + NextAuth).
- GitHub repo is public `Sa-ar/saar-to` (local clone directory may still be `node-url-shortener`); `master` is PR-only.
- Production stack decision: Vercel Hobby for the app, MongoDB Atlas M0 for the database; details live in `docs/production.md`.
- Local auth uses `NEXTAUTH_URL=http://localhost:3000`; production uses `https://saar.to`; preview leaves `NEXTAUTH_URL` unset and uses `VERCEL_URL`.
- Production and Preview need `NEXTAUTH_SECRET`, `MONGODB_URI`, and `BLOB_READ_WRITE_TOKEN` on Vercel; never commit `.env.local` or secrets.
- Owner invites, auth, vanity `slug.saar.to` redirects, ClickEvent analytics, file destinations, QR/notes, and OG/password gates are shipped.
- Do not build a registrar DNS panel or mixed-record subdomain manager into saar.to; DNS for other domains stays at the registrar (Cloudflare nameservers if they want easier DNS UX).
- Owners are bootstrapped only via CLI (`npm run create-user`); public registration is invite-only for members; owners see all links/clicks, members only their own.
- Keep apex `saar.to` as the primary Vercel domain (avoid forcing traffic to `www`).
- Atlas Network Access must allow Vercel Hobby egress (`0.0.0.0/0` on M0) or sign-in and redirects fail; scope the Vercel DB user to `readWrite` on `url-shortener` only and IP-restrict any admin/CLI Atlas user.
- File destinations upload through `/api/blob/upload` to the linked public Blob store (`saar-to-files`) or accept a pasted https file URL; each link chooses Open vs Download.
- Owners can attach the same destination to both `saar.to/slug` and `slug.saar.to` (`SHORT_URL_KIND.BOTH`).

## Cursor Cloud specific instructions

Standard commands live in `README.md` / `package.json` scripts (`npm run dev`, `npm run build`, `npm run lint`, `npm run create-user`). Notes below are the non-obvious bits for running this app in the Cloud VM.

- Services: this is a single Next.js app plus a local MongoDB. Both must be up to exercise the product end to end.
- MongoDB: MongoDB Community 8.0 is preinstalled in the VM image, but is not started automatically. Start it before running the app or `create-user`:
  `sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --bind_ip 127.0.0.1` (run it in a background/tmux session). Confirm with `mongosh --quiet --eval "db.runCommand({ ping: 1 })"`.
- `.env.local` is git-ignored (never commit it) and is required for `npm run dev` and `npm run create-user`. If it is missing, recreate it with:
  `MONGODB_URI=mongodb://127.0.0.1:27017/url-shortener`, `NEXT_PUBLIC_BASE_URL=http://localhost:3000`, `NEXTAUTH_URL=http://localhost:3000`, and a `NEXTAUTH_SECRET` from `openssl rand -base64 32`. Use `NEXT_PUBLIC_BASE_URL=http://localhost:3000` locally so copied/redirect short links point at localhost, not `https://saar.to`.
- Auth is invite-only: there is no public signup. Bootstrap a login with `npm run create-user -- --name "Owner" --email owner@saar.to --password 'devpassword123'`, then sign in at `/login`.
- End-to-end sanity check: create a link at `/new`, then `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/<slug>` should return `307` with the destination as `redirect_url`.
- `next dev` rewrites the `nextjs-agent-rules` block at the bottom of this file on every run; that uncommitted change is expected and harmless (committing it keeps the tree clean).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
