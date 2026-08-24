import {
  ShortUrl,
  type ShortUrlDoc,
  type ShortUrlMetaTag,
  type ShortUrlUnfurl,
} from "@/lib/models/short-url";
import { HTTP_REDIRECT } from "@/lib/http";
import { LIMITS, MAX_UNFURL_BYTES, UNFURL_TTL_MS } from "@/lib/limits";
import { fetchPinned, resolveSafeOutboundUrl } from "@/lib/ssrf";

const REDIRECT_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 2_500;

const HTML_META = {
  APPLE_ITUNES_APP: "apple-itunes-app",
} as const;

type RefreshOptions = {
  timeoutMs?: number;
};

type FetchHtmlResult = {
  finalUrl: URL;
  html: string;
};

function collapseWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function truncate(value: string | null | undefined, maxLength = 500) {
  const normalized = collapseWhitespace(value);
  return normalized ? normalized.slice(0, maxLength) : null;
}

function parseMetaAttributes(tag: string) {
  const attrs = new Map<string, string>();
  const attrPattern = /([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;

  for (const match of tag.matchAll(attrPattern)) {
    const key = match[1]?.toLowerCase();
    const rawValue = match[3] ?? match[4] ?? match[5] ?? "";
    if (key) {
      attrs.set(key, decodeHtmlEntities(rawValue));
    }
  }

  return attrs;
}

function resolveMaybeUrl(value: string | null | undefined, base: URL) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function parseMetaTagMap(html: string) {
  const metaTags = new Map<string, string>();
  const rawAppLinks: ShortUrlMetaTag[] = [];

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseMetaAttributes(match[0]);
    const key = attrs.get("property") ?? attrs.get("name");
    const content = attrs.get("content");
    if (!key || !content) {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    metaTags.set(normalizedKey, content);
    if (normalizedKey.startsWith("al:") || normalizedKey === HTML_META.APPLE_ITUNES_APP) {
      rawAppLinks.push({ key: normalizedKey, value: content });
    }
  }

  return { metaTags, rawAppLinks };
}

function parseTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1] ?? "") : "";
}

async function readBody(response: Response) {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let result = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    total += chunk.value.byteLength;
    if (total > MAX_UNFURL_BYTES) {
      throw new Error("HTML body too large");
    }

    result += decoder.decode(chunk.value, { stream: true });
  }

  result += decoder.decode();
  return result;
}

async function fetchHtml(input: URL, timeoutMs: number): Promise<FetchHtmlResult> {
  let current = input;

  for (let attempt = 0; attempt <= REDIRECT_LIMIT; attempt += 1) {
    const target = await resolveSafeOutboundUrl(current);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = (await fetchPinned(target, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "saar.to unfurl bot/1.0",
        },
      })) as unknown as Response;
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= HTTP_REDIRECT.MIN && response.status < HTTP_REDIRECT.MAX) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Redirect missing location header");
      }

      current = new URL(location, current);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new Error("Destination did not return HTML");
    }

    const html = await readBody(response);
    return { finalUrl: current, html };
  }

  throw new Error("Too many redirects");
}

function toUnfurl(html: string, finalUrl: URL): ShortUrlUnfurl | null {
  const { metaTags, rawAppLinks } = parseMetaTagMap(html);
  const title =
    truncate(metaTags.get("og:title")) ??
    truncate(metaTags.get("twitter:title")) ??
    truncate(parseTitle(html));

  const description =
    truncate(metaTags.get("og:description")) ??
    truncate(metaTags.get("twitter:description")) ??
    truncate(metaTags.get("description"));

  const image =
    resolveMaybeUrl(metaTags.get("og:image") ?? metaTags.get("twitter:image"), finalUrl) ?? null;

  if (!title && !description && !image && rawAppLinks.length === 0) {
    return null;
  }

  return {
    title,
    description,
    image,
    imageAlt: truncate(metaTags.get("og:image:alt")) ?? truncate(metaTags.get("twitter:image:alt")),
    imageWidth: truncate(metaTags.get("og:image:width"), LIMITS.UNFURL_DIM_MAX),
    imageHeight: truncate(metaTags.get("og:image:height"), LIMITS.UNFURL_DIM_MAX),
    siteName: truncate(metaTags.get("og:site_name")),
    type: truncate(metaTags.get("og:type"), LIMITS.UNFURL_TOKEN_MAX),
    twitterCard: truncate(metaTags.get("twitter:card"), LIMITS.UNFURL_TOKEN_MAX),
    video: resolveMaybeUrl(metaTags.get("og:video"), finalUrl),
    videoSecureUrl: resolveMaybeUrl(metaTags.get("og:video:secure_url"), finalUrl),
    videoType: truncate(metaTags.get("og:video:type"), LIMITS.UNFURL_TOKEN_MAX),
    appLinks: rawAppLinks,
    finalUrl: finalUrl.toString(),
    fetchedAt: new Date(),
  };
}

export function isUnfurlStale(unfurl: ShortUrlUnfurl | null | undefined) {
  if (!unfurl?.fetchedAt) {
    return true;
  }

  return Date.now() - new Date(unfurl.fetchedAt).getTime() > UNFURL_TTL_MS;
}

export async function fetchUnfurlMetadata(
  input: string,
  options?: RefreshOptions,
): Promise<ShortUrlUnfurl | null> {
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const url = new URL(input);
  const { finalUrl, html } = await fetchHtml(url, timeoutMs);
  return toUnfurl(html, finalUrl);
}

export async function refreshShortUrlUnfurl(doc: ShortUrlDoc, options?: RefreshOptions) {
  const unfurl = await fetchUnfurlMetadata(doc.full, options);
  doc.unfurl = unfurl;
  await doc.save();
  return unfurl;
}

export async function refreshShortUrlUnfurlById(id: string, options?: RefreshOptions) {
  const doc = await ShortUrl.findById(id);
  if (!doc) {
    return null;
  }

  try {
    return await refreshShortUrlUnfurl(doc, options);
  } catch (error) {
    console.warn("[unfurl] failed to refresh metadata", { id, error });
    return null;
  }
}
