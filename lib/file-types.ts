import type { FileDisposition } from "@/lib/types";
import { FILE_DISPOSITION } from "@/lib/link-enums";
import { MAX_FILE_BYTES } from "@/lib/limits";

export { MAX_FILE_BYTES };

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
] as const;

const NEVER_INLINE = new Set([
  "text/html",
  "application/javascript",
  "text/javascript",
  "image/svg+xml",
  "text/xml",
  "application/xml",
  "application/xhtml+xml",
]);

export function isAllowedFileType(contentType: string) {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return (ALLOWED_FILE_TYPES as readonly string[]).includes(type);
}

export function mustForceAttachment(contentType: string) {
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return NEVER_INLINE.has(type);
}

export function normalizeDisposition(
  disposition: FileDisposition | undefined,
  contentType: string,
): FileDisposition {
  if (mustForceAttachment(contentType)) {
    return FILE_DISPOSITION.ATTACHMENT;
  }
  return disposition === FILE_DISPOSITION.ATTACHMENT
    ? FILE_DISPOSITION.ATTACHMENT
    : FILE_DISPOSITION.INLINE;
}
