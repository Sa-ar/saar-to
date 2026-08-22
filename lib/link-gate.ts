import { createHmac, timingSafeEqual } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { SHORT_URL_KIND, type PublicHitKind } from "@/lib/kinds";
import type { ShortUrlAttrs } from "@/lib/models/short-url";
import { HTTP_STATUS } from "@/lib/http";
import { NODE_ENV } from "@/lib/link-enums";
import { LIMITS, UNLOCK_COOKIE_MAX_AGE_SECONDS } from "@/lib/limits";

const COOKIE_PREFIX = "saar_unlock_";

function signingSecret() {
  return process.env.NEXTAUTH_SECRET || "dev-unlock-secret";
}

function cookieName(id: string) {
  return `${COOKIE_PREFIX}${id}`;
}

function cookieValue(id: string) {
  return createHmac("sha256", signingSecret()).update(id).digest("hex");
}

export async function hashLinkPassword(password: string) {
  return hash(password, LIMITS.BCRYPT_ROUNDS);
}

export function hasUnlockCookie(request: Request, id: string) {
  const cookie = request.headers.get("cookie") ?? "";
  const parts = cookie.split(";").map((part) => part.trim());
  const found = parts.find((part) => part.startsWith(`${cookieName(id)}=`));
  if (!found) {
    return false;
  }
  const value = found.slice(cookieName(id).length + 1);
  const a = Buffer.from(value);
  const b = Buffer.from(cookieValue(id));
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function needsPassword(
  doc: Pick<ShortUrlAttrs, "passwordHash"> & { _id: { toString(): string } },
  request: Request,
) {
  if (!doc.passwordHash) {
    return false;
  }
  return !hasUnlockCookie(request, doc._id.toString());
}

export async function verifyLinkPassword(passwordHash: string, password: string) {
  return compare(password, passwordHash);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function unlockPage(shortLabel: string, actionPath: string, invalid = false) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Protected link · saar.to</title>
    <style>
      :root { color-scheme: dark; }
      body { margin:0; min-height:100vh; display:grid; place-items:center;
        font-family: ui-sans-serif, system-ui, sans-serif; background:#0a0512; color:#f8f1ff; }
      form { width:min(24rem, calc(100% - 2rem)); display:grid; gap:1rem;
        padding:1.5rem; border-radius:1rem; background:#15091f; box-shadow:0 0 0 1px rgb(248 241 255 / 12%); }
      label { font-size:.8rem; letter-spacing:.12em; text-transform:uppercase; color:#c9bdd6; }
      input { height:2.5rem; border-radius:999px; border:1px solid rgb(248 241 255 / 14%);
        background:#1f122c; color:#f8f1ff; padding:0 1rem; }
      button { height:2.5rem; border:0; border-radius:999px; background:#f9d026; color:#0a0512; font-weight:600; }
      .err { color:#f87171; font-size:.875rem; }
      .brand { font-family: ui-monospace, monospace; font-size:.75rem; letter-spacing:.22em;
        text-transform:uppercase; color:#f9d026; }
    </style>
  </head>
  <body>
    <form method="post" action="${escapeHtml(actionPath)}">
      <p class="brand">saar.to</p>
      <h1>This link is protected</h1>
      <p>${escapeHtml(shortLabel)}</p>
      ${invalid ? `<p class="err">That password is not correct.</p>` : ""}
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" />
      <button type="submit">Unlock</button>
    </form>
  </body>
</html>`;

  return new NextResponse(html, {
    status: invalid ? HTTP_STATUS.UNAUTHORIZED : HTTP_STATUS.OK,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function setUnlockCookie(response: NextResponse, id: string) {
  response.cookies.set({
    name: cookieName(id),
    value: cookieValue(id),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === NODE_ENV.PRODUCTION,
    path: "/",
    maxAge: UNLOCK_COOKIE_MAX_AGE_SECONDS,
  });
}

export function unlockActionPath(kind: PublicHitKind, code: string) {
  return kind === SHORT_URL_KIND.SUBDOMAIN ? "/" : `/${encodeURIComponent(code)}`;
}
