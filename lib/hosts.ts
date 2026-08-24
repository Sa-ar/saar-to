import { HOST_LABEL } from "@/lib/link-enums";
const DEFAULT_APEX = "saar.to";

/** Apex hostname used for vanity URLs (never a preview host). */
export function getApexHostname(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) {
    try {
      return new URL(base).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      // fall through
    }
  }
  return DEFAULT_APEX;
}

export function getApexOrigin(): string {
  return `https://${getApexHostname()}`;
}

/**
 * If host is a single-label vanity subdomain of the apex (e.g. resume.saar.to),
 * return the label. Apex, www, and multi-level hosts return null.
 */
export function parseVanityLabel(hostHeader: string | null): string | null {
  if (!hostHeader) {
    return null;
  }

  const hostname = hostHeader.split(":")[0]?.toLowerCase() ?? "";
  const apex = getApexHostname();

  if (hostname === apex || hostname === `www.${apex}`) {
    return null;
  }

  const suffix = `.${apex}`;
  if (!hostname.endsWith(suffix)) {
    return null;
  }

  const label = hostname.slice(0, -suffix.length);
  if (!label || label.includes(".") || label === HOST_LABEL.WWW) {
    return null;
  }

  return label;
}

export function vanityHostname(label: string): string {
  return `${label.toLowerCase()}.${getApexHostname()}`;
}

export function vanityShortUrl(label: string): string {
  return `https://${vanityHostname(label)}`;
}
