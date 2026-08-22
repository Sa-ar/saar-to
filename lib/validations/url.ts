import { z } from "zod";
import { isAllowedFileType, mustForceAttachment } from "@/lib/file-types";
import {
  FILE_DISPOSITION,
  FILE_DISPOSITION_VALUES,
  FILE_SOURCE,
  FILE_SOURCE_VALUES,
  HOST_LABEL,
  SHORT_URL_TARGET,
  SHORT_URL_TARGET_VALUES,
  type FileSource,
  type ShortUrlTarget,
} from "@/lib/link-enums";
import { LIMITS } from "@/lib/limits";
import {
  SHORT_URL_KIND,
  SHORT_URL_KIND_VALUES,
  kindHasPath,
  kindHasSubdomain,
  type ShortUrlKind,
} from "@/lib/kinds";

export type { ShortUrlKind };
export { kindHasPath, kindHasSubdomain };

/**
 * First-path segments the app serves itself (see `proxy.ts` and the `app/`
 * routes). None of these may be claimed as a short-link slug, otherwise the
 * short link would shadow a real page/route.
 */
export const RESERVED_SLUGS = new Set([
  "api",
  "stats",
  "new",
  "login",
  "register",
  "signin",
  "signup",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "go",
  HOST_LABEL.WWW,
  "app",
  "mail",
  "admin",
  "cdn",
  "vercel",
]);

/** True when the slug collides with a reserved app path (case-insensitive). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

const slugPattern = /^[a-zA-Z0-9_-]+$/;
/** DNS labels: letters, digits, hyphens; no underscores. */
const subdomainLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/i;

/**
 * Validate a slug/subdomain label, adding issues on the `slug` path.
 * Reserved paths are rejected first so the user gets the clearest reason.
 * When `required` is false an empty path slug is allowed (auto-generated);
 * subdomain / both always require a slug. Subdomain/both use DNS label rules.
 */
function addSlugIssues(
  rawSlug: string,
  kind: ShortUrlKind,
  ctx: z.RefinementCtx,
  required: boolean,
) {
  const slug = rawSlug.trim();
  const needsSubdomainRules = kindHasSubdomain(kind);
  const noun = needsSubdomainRules ? (kind === SHORT_URL_KIND.BOTH ? "Slug" : "Subdomain") : "Slug";

  if (slug === "") {
    if (required || needsSubdomainRules) {
      ctx.addIssue({
        code: "custom",
        message: `${noun} is required`,
        path: ["slug"],
      });
    }
    return;
  }

  if (isReservedSlug(slug)) {
    ctx.addIssue({
      code: "custom",
      message: `This ${noun.toLowerCase()} is reserved`,
      path: ["slug"],
    });
    return;
  }

  if (slug.length < LIMITS.SLUG_MIN || slug.length > LIMITS.SLUG_MAX) {
    ctx.addIssue({
      code: "custom",
      message: `${noun} must be ${LIMITS.SLUG_MIN}–${LIMITS.SLUG_MAX} characters`,
      path: ["slug"],
    });
    return;
  }

  const pattern = needsSubdomainRules ? subdomainLabelPattern : slugPattern;
  if (!pattern.test(slug)) {
    ctx.addIssue({
      code: "custom",
      message: needsSubdomainRules
        ? "Use letters, numbers, or hyphens"
        : "Use letters, numbers, underscores, or hyphens",
      path: ["slug"],
    });
  }
}

function addExpiryIssues(rawExpiresAt: string, ctx: z.RefinementCtx) {
  const expiresAt = rawExpiresAt.trim();
  if (expiresAt === "") {
    return;
  }

  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid date",
      path: ["expiresAt"],
    });
  } else if (date.getTime() <= Date.now()) {
    ctx.addIssue({
      code: "custom",
      message: "Expiry must be in the future",
      path: ["expiresAt"],
    });
  }
}

function addFullUrlIssues(
  data: {
    fullUrl: string;
    target: ShortUrlTarget;
  },
  ctx: z.RefinementCtx,
) {
  const value = data.fullUrl.trim();

  if (data.target === SHORT_URL_TARGET.FILE) {
    if (value === "") {
      // File-source messaging is handled in addFileIssues first.
      return;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") {
        ctx.addIssue({
          code: "custom",
          message: "File URL must start with https://",
          path: ["fullUrl"],
        });
      }
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid file URL",
        path: ["fullUrl"],
      });
    }
    return;
  }

  if (value === "") {
    ctx.addIssue({
      code: "custom",
      message: "URL is required",
      path: ["fullUrl"],
    });
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      ctx.addIssue({
        code: "custom",
        message: "URL must start with http:// or https://",
        path: ["fullUrl"],
      });
    }
  } catch {
    ctx.addIssue({
      code: "custom",
      message: "Enter a valid URL",
      path: ["fullUrl"],
    });
  }
}

const baseUrlObject = z.object({
  fullUrl: z.string().trim(),
  slug: z.string(),
  expiresAt: z.string(),
  kind: z.enum(SHORT_URL_KIND_VALUES),
  target: z.enum(SHORT_URL_TARGET_VALUES).default(SHORT_URL_TARGET.URL),
  disposition: z.enum(FILE_DISPOSITION_VALUES).optional(),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().optional(),
  fileSource: z.enum(FILE_SOURCE_VALUES).optional(),
  note: z.string().optional(),
  password: z.string().optional(),
  removePassword: z.boolean().optional(),
  ogTitle: z.string().optional(),
  ogDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
});

function addFileIssues(
  data: {
    target: ShortUrlTarget;
    fullUrl: string;
    fileName?: string;
    contentType?: string;
    fileSource?: FileSource;
    fileSize?: number;
  },
  ctx: z.RefinementCtx,
) {
  if (data.target !== SHORT_URL_TARGET.FILE) {
    return;
  }

  if (data.fileSource !== FILE_SOURCE.BLOB && data.fileSource !== FILE_SOURCE.EXTERNAL) {
    ctx.addIssue({
      code: "custom",
      message: "Upload a file or paste an https file URL",
      path: ["fileSource"],
    });
    return;
  }

  if (!data.fileName?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "File name is required",
      path: ["fileName"],
    });
  }

  if (!data.fullUrl.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Upload a file or paste an https file URL",
      path: ["fileSource"],
    });
  }

  const contentType = data.contentType?.trim() ?? "";
  if (contentType && !isAllowedFileType(contentType) && mustForceAttachment(contentType)) {
    ctx.addIssue({
      code: "custom",
      message: "That file type is not allowed",
      path: ["contentType"],
    });
  } else if (contentType && !isAllowedFileType(contentType)) {
    ctx.addIssue({
      code: "custom",
      message: "Use a PDF, image, zip, or Office document",
      path: ["contentType"],
    });
  }
}

function normalizeSlug(slug: string, kind: ShortUrlKind): string | undefined {
  const trimmed = slug.trim();
  if (trimmed === "") {
    return undefined;
  }
  return kindHasSubdomain(kind) ? trimmed.toLowerCase() : trimmed;
}

function transformUrlData(data: z.infer<typeof baseUrlObject>) {
  const kind = data.kind;
  const target =
    data.target === SHORT_URL_TARGET.FILE ? SHORT_URL_TARGET.FILE : SHORT_URL_TARGET.URL;
  return {
    fullUrl: data.fullUrl.trim(),
    slug: normalizeSlug(data.slug, kind),
    expiresAt: data.expiresAt.trim() === "" ? undefined : data.expiresAt.trim(),
    kind,
    target: target === SHORT_URL_TARGET.FILE ? SHORT_URL_TARGET.FILE : SHORT_URL_TARGET.URL,
    disposition:
      target === SHORT_URL_TARGET.FILE
        ? data.disposition === FILE_DISPOSITION.ATTACHMENT
          ? FILE_DISPOSITION.ATTACHMENT
          : FILE_DISPOSITION.INLINE
        : undefined,
    fileName: target === SHORT_URL_TARGET.FILE ? data.fileName?.trim() : undefined,
    contentType: target === SHORT_URL_TARGET.FILE ? data.contentType?.trim() : undefined,
    fileSize: target === SHORT_URL_TARGET.FILE ? data.fileSize : undefined,
    fileSource: target === SHORT_URL_TARGET.FILE ? data.fileSource : undefined,
    note: data.note?.trim() ? data.note.trim().slice(0, LIMITS.NOTE_MAX) : undefined,
    password: data.password?.trim() || undefined,
    removePassword: data.removePassword === true,
    ogTitle: data.ogTitle?.trim() || undefined,
    ogDescription: data.ogDescription?.trim() || undefined,
    ogImageUrl: data.ogImageUrl?.trim() || undefined,
  };
}

export const createUrlSchema = baseUrlObject
  .superRefine((data, ctx) => {
    addFileIssues(data, ctx);
    addFullUrlIssues(data, ctx);
    addSlugIssues(data.slug, data.kind, ctx, false);
    addExpiryIssues(data.expiresAt, ctx);
  })
  .transform(transformUrlData);

/**
 * Editing an existing link. A short code always exists, so the slug is
 * required for path, subdomain, and both.
 */
export const editUrlSchema = baseUrlObject
  .superRefine((data, ctx) => {
    addFileIssues(data, ctx);
    addFullUrlIssues(data, ctx);
    addSlugIssues(data.slug, data.kind, ctx, true);
    addExpiryIssues(data.expiresAt, ctx);
  })
  .transform((data) => {
    const result = transformUrlData(data);
    return {
      ...result,
      slug: result.slug ?? data.slug.trim(),
    };
  });

export type CreateUrlInput = z.input<typeof createUrlSchema>;
export type CreateUrlValues = z.output<typeof createUrlSchema>;
export type EditUrlInput = z.input<typeof editUrlSchema>;
export type EditUrlValues = z.output<typeof editUrlSchema>;

export function formatFormError(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Invalid value";
}
