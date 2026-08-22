import { NextResponse } from "next/server";
import { getUserAgent, isSocialCrawler } from "@/lib/crawlers";
import type { ShortUrlAttrs, ShortUrlMetaTag, ShortUrlUnfurl } from "@/lib/models/short-url";

export function isPreviewCrawler(request: Request) {
  return isSocialCrawler(getUserAgent(request));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function hasCustomOg(doc: Pick<ShortUrlAttrs, "ogTitle" | "ogDescription" | "ogImageUrl">) {
  return Boolean(doc.ogTitle || doc.ogDescription || doc.ogImageUrl);
}

function appendMetaTag(lines: string[], key: string, value: string | null | undefined) {
  if (!value) {
    return;
  }

  const attr = key.startsWith("og:") || key.startsWith("al:") ? "property" : "name";
  lines.push(`    <meta ${attr}="${escapeHtml(key)}" content="${escapeHtml(value)}" />`);
}

function uniqueMetaTags(tags: ShortUrlMetaTag[]) {
  const entries = new Map<string, string>();
  for (const tag of tags) {
    const key = tag.key.trim().toLowerCase();
    const value = tag.value.trim();
    if (key && value && !entries.has(key)) {
      entries.set(key, value);
    }
  }

  return Array.from(entries.entries()).map(([key, value]) => ({ key, value }));
}

export function ogPage(
  doc: Pick<
    ShortUrlAttrs,
    | "short"
    | "ogTitle"
    | "ogDescription"
    | "ogImageUrl"
    | "passwordHash"
    | "full"
    | "fileName"
    | "unfurl"
  >,
  canonical: string,
  options?: {
    forwardedUnfurl?: ShortUrlUnfurl | null;
    extraAppLinks?: ShortUrlMetaTag[];
    script?: string;
  },
) {
  const protectedLink = Boolean(doc.passwordHash);
  // Password-gated links must not emit destination unfurl / App Links metadata.
  const unfurl = protectedLink ? null : (options?.forwardedUnfurl ?? doc.unfurl ?? null);
  const title =
    protectedLink && !doc.ogTitle
      ? "Protected link · saar.to"
      : doc.ogTitle || unfurl?.title || doc.fileName || doc.short || "saar.to";
  const description =
    protectedLink && !doc.ogDescription
      ? "This saar.to link is password protected."
      : doc.ogDescription || unfurl?.description || "A saar.to short link.";
  const image = protectedLink && !doc.ogImageUrl ? "" : doc.ogImageUrl || unfurl?.image || "";
  const appLinks = protectedLink
    ? []
    : uniqueMetaTags([...(unfurl?.appLinks ?? []), ...(options?.extraAppLinks ?? [])]);

  const lines = [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `    <title>${escapeHtml(title)}</title>`,
    `    <link rel="canonical" href="${escapeHtml(canonical)}" />`,
  ];

  appendMetaTag(lines, "description", description);
  appendMetaTag(lines, "og:type", unfurl?.type ?? "website");
  appendMetaTag(lines, "og:url", canonical);
  appendMetaTag(lines, "og:title", title);
  appendMetaTag(lines, "og:description", description);
  appendMetaTag(lines, "og:site_name", unfurl?.siteName ?? "saar.to");
  appendMetaTag(lines, "og:image", image);
  appendMetaTag(lines, "og:image:alt", unfurl?.imageAlt);
  appendMetaTag(lines, "og:image:width", unfurl?.imageWidth);
  appendMetaTag(lines, "og:image:height", unfurl?.imageHeight);
  appendMetaTag(lines, "og:video", unfurl?.video);
  appendMetaTag(lines, "og:video:secure_url", unfurl?.videoSecureUrl);
  appendMetaTag(lines, "og:video:type", unfurl?.videoType);
  appendMetaTag(
    lines,
    "twitter:card",
    unfurl?.twitterCard ?? (image ? "summary_large_image" : "summary"),
  );
  appendMetaTag(lines, "twitter:url", canonical);
  appendMetaTag(lines, "twitter:title", title);
  appendMetaTag(lines, "twitter:description", description);
  appendMetaTag(lines, "twitter:image", image);
  appendMetaTag(lines, "twitter:image:alt", unfurl?.imageAlt);

  for (const tag of appLinks) {
    appendMetaTag(lines, tag.key, tag.value);
  }

  lines.push("  </head>", "  <body>", `    <p>${escapeHtml(title)}</p>`);
  if (options?.script) {
    // Keep </script> from ending the element early if a payload slips past callers.
    const safeScript = options.script.replace(/<\/(script)/gi, "<\\/$1");
    lines.push(`    <script>${safeScript}</script>`);
  }
  lines.push("  </body>", "</html>");

  return new NextResponse(lines.join("\n"), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
