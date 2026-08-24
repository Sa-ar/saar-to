import mongoose from "mongoose";
import { isExpired } from "@/lib/dates";
import { vanityShortUrl } from "@/lib/hosts";
import { ShortUrl, type ShortUrlAttrs } from "@/lib/models/short-url";
import {
  PATH_HIT_KINDS,
  conflictingKinds,
  kindHasPath,
  kindHasSubdomain,
  parseShortUrlKind,
  type ShortUrlKind,
} from "@/lib/kinds";
import type { DailyClick, ShortUrlDto, ShortUrlTarget } from "@/lib/types";
import { FILE_DISPOSITION, FILE_SOURCE, SHORT_URL_TARGET } from "@/lib/link-enums";
import { MONGO_ERROR } from "@/lib/mongo-errors";
import { USER_ROLE } from "@/lib/user-role";

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/** Production apex. Prefer `getBaseUrl()` at runtime. */
export const APEX_ORIGIN = "https://saar.to";

export function getBaseUrl(request?: Request) {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return APEX_ORIGIN;
}

export function shortUrlKind(
  doc: Pick<ShortUrlAttrs, "kind"> | { kind?: string | null },
): ShortUrlKind {
  return parseShortUrlKind(doc.kind);
}

export function shortUrlTarget(
  doc: Pick<ShortUrlAttrs, "target"> | { target?: string | null },
): ShortUrlTarget {
  return doc.target === SHORT_URL_TARGET.FILE ? SHORT_URL_TARGET.FILE : SHORT_URL_TARGET.URL;
}

export { conflictingKinds } from "@/lib/kinds";

/**
 * Returns true when another document already claims the short label
 * under a conflicting kind (path vs both, subdomain vs both, etc.).
 */
export async function hasSlugCollision(
  short: string,
  kind: ShortUrlKind,
  excludeId?: string,
): Promise<boolean> {
  const filter: Record<string, unknown> = {
    short,
    kind: { $in: conflictingKinds(kind) },
  };
  if (excludeId && OBJECT_ID_RE.test(excludeId)) {
    filter._id = { $ne: excludeId };
  }
  const existing = await ShortUrl.findOne(filter).select("_id").lean();
  return Boolean(existing);
}

export function serializeShortUrl(
  doc: Omit<ShortUrlAttrs, "dailyClicks"> & {
    _id: { toString(): string };
    dailyClicks?: DailyClick[];
  },
  baseUrl: string,
  extras?: { createdByName?: string | null },
): ShortUrlDto {
  const kind = shortUrlKind(doc);
  const pathUrl = kindHasPath(kind) ? `${baseUrl}/${doc.short}` : null;
  const vanityUrl = kindHasSubdomain(kind) ? vanityShortUrl(doc.short) : null;
  return {
    id: doc._id.toString(),
    full: doc.full,
    short: doc.short,
    shortUrl: vanityUrl ?? pathUrl ?? `${baseUrl}/${doc.short}`,
    pathUrl,
    kind,
    target: shortUrlTarget(doc),
    disposition:
      doc.disposition === FILE_DISPOSITION.ATTACHMENT
        ? FILE_DISPOSITION.ATTACHMENT
        : doc.disposition === FILE_DISPOSITION.INLINE
          ? FILE_DISPOSITION.INLINE
          : null,
    fileName: doc.fileName ?? null,
    contentType: doc.contentType ?? null,
    fileSize: doc.fileSize ?? null,
    fileSource:
      doc.fileSource === FILE_SOURCE.BLOB || doc.fileSource === FILE_SOURCE.EXTERNAL
        ? doc.fileSource
        : null,
    note: doc.note ?? null,
    createdByName: extras?.createdByName ?? null,
    hasPassword: Boolean(doc.passwordHash),
    ogTitle: doc.ogTitle ?? null,
    ogDescription: doc.ogDescription ?? null,
    ogImageUrl: doc.ogImageUrl ?? null,
    clicks: doc.clicks,
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
    lastAccessedAt: doc.lastAccessedAt ? new Date(doc.lastAccessedAt).toISOString() : null,
    dailyClicks: doc.dailyClicks ?? [],
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
    expired: isExpired(doc.expiresAt),
  };
}

export function listShortUrls(filter: { userId?: string } = {}) {
  return ShortUrl.find(filter).sort({ createdAt: -1 }).select("-dailyClicks").lean();
}

export function findShortUrl(id: string) {
  if (OBJECT_ID_RE.test(id)) {
    return ShortUrl.findOne({ _id: id });
  }

  // Bare slug lookups mean path-capable links (path or both).
  return ShortUrl.findOne({
    short: id,
    kind: { $in: [...PATH_HIT_KINDS] },
  });
}

export function findOwnedShortUrl(id: string, userId: string) {
  if (OBJECT_ID_RE.test(id)) {
    return ShortUrl.findOne({ _id: id, userId });
  }

  return ShortUrl.findOne({
    userId,
    short: id,
    kind: { $in: [...PATH_HIT_KINDS] },
  });
}

export function findAccessibleShortUrl(
  id: string,
  userId: string,
  role: string | null | undefined,
) {
  if (role === USER_ROLE.OWNER) {
    return findShortUrl(id);
  }

  return findOwnedShortUrl(id, userId);
}

export function recordClick(doc: { clicks: number; lastAccessedAt?: Date | null }) {
  doc.clicks += 1;
  doc.lastAccessedAt = new Date();
}

export function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === MONGO_ERROR.DUPLICATE_KEY
  );
}

export function isMongooseValidationError(error: unknown): error is mongoose.Error.ValidationError {
  return error instanceof mongoose.Error.ValidationError;
}
