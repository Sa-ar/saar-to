import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { MAX_FILE_BYTES, normalizeDisposition } from "@/lib/file-types";
import type { ShortUrlAttrs } from "@/lib/models/short-url";
import type { FileDisposition, FileSource } from "@/lib/types";

export {
  ALLOWED_FILE_TYPES,
  MAX_FILE_BYTES,
  isAllowedFileType,
  mustForceAttachment,
  normalizeDisposition,
} from "@/lib/file-types";

function contentDispositionHeader(disposition: FileDisposition, fileName: string) {
  const fallback = fileName.replace(/["\\\r\n]/g, "_") || "download";
  const encoded = encodeURIComponent(fileName || "download");
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  return false;
}

function isPrivateIp(ip: string) {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    value === "::1" ||
    value.startsWith("fe80:") ||
    value.startsWith("fc") ||
    value.startsWith("fd")
  ) {
    return true;
  }
  if (value.startsWith("::ffff:")) {
    return isPrivateIpv4(value.slice(7));
  }
  if (isIP(value) === 4) {
    return isPrivateIpv4(value);
  }
  return false;
}

export async function assertSafeHttpsUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Enter a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new Error("File URLs must use https");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error("That host is not allowed");
  }

  if (isIP(hostname) && isPrivateIp(hostname)) {
    throw new Error("That host is not allowed");
  }

  const resolved = await lookup(hostname, { all: true });
  if (resolved.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("That host is not allowed");
  }

  return url;
}

async function fetchFileResponse(url: string, source: FileSource) {
  if (source === "external") {
    await assertSafeHttpsUrl(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, 10_000);

  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      return null;
    }

    const length = Number(response.headers.get("content-length") ?? "0");
    if (length > MAX_FILE_BYTES) {
      return null;
    }

    return response;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function serveFile(doc: ShortUrlAttrs) {
  const source: FileSource = doc.fileSource === "external" ? "external" : "blob";
  const response = await fetchFileResponse(doc.full, source);
  if (!response?.body) {
    return new NextResponse("File unavailable", { status: 502 });
  }

  const contentType =
    doc.contentType || response.headers.get("content-type") || "application/octet-stream";
  const disposition = normalizeDisposition(
    doc.disposition === "attachment" ? "attachment" : "inline",
    contentType,
  );
  const fileName = doc.fileName?.trim() || "download";

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": contentDispositionHeader(disposition, fileName),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

export async function deleteStoredBlob(url: string | null | undefined) {
  if (!url || !process.env.BLOB_READ_WRITE_TOKEN) {
    return;
  }

  try {
    await del(url);
  } catch (error) {
    console.error("[files] blob delete failed:", error);
  }
}

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function assignFileTarget(
  doc: {
    full: string;
    target: "url" | "file";
    disposition?: FileDisposition | null;
    fileName?: string | null;
    contentType?: string | null;
    fileSize?: number | null;
    fileSource?: FileSource | null;
  },
  data: {
    fullUrl: string;
    target: "url" | "file";
    disposition?: FileDisposition;
    fileName?: string;
    contentType?: string;
    fileSize?: number;
    fileSource?: FileSource;
  },
) {
  doc.full = data.fullUrl;
  doc.target = data.target;
  if (data.target === "file") {
    const contentType = data.contentType?.trim() || "application/octet-stream";
    doc.disposition = normalizeDisposition(data.disposition, contentType);
    doc.fileName = data.fileName?.trim() || "download";
    doc.contentType = contentType;
    doc.fileSize = data.fileSize ?? null;
    doc.fileSource = data.fileSource === "blob" ? "blob" : "external";
    return;
  }

  doc.disposition = null;
  doc.fileName = null;
  doc.contentType = null;
  doc.fileSize = null;
  doc.fileSource = null;
}
