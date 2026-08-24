/**
 * Canonical short-link host kinds. Prefer `SHORT_URL_KIND.*` over string
 * literals — oxlint flags magic tokens; define values here with `as const`.
 */
export const SHORT_URL_KIND = {
  PATH: "path",
  SUBDOMAIN: "subdomain",
  BOTH: "both",
} as const;

export type ShortUrlKind = (typeof SHORT_URL_KIND)[keyof typeof SHORT_URL_KIND];

/** Ordered tuple for zod / mongoose enums. */
export const SHORT_URL_KIND_VALUES = [
  SHORT_URL_KIND.PATH,
  SHORT_URL_KIND.SUBDOMAIN,
  SHORT_URL_KIND.BOTH,
] as const;

/** How a public hit arrived (apex path vs vanity host). Never `both`. */
export type PublicHitKind = typeof SHORT_URL_KIND.PATH | typeof SHORT_URL_KIND.SUBDOMAIN;

export function isShortUrlKind(value: unknown): value is ShortUrlKind {
  return (
    value === SHORT_URL_KIND.PATH ||
    value === SHORT_URL_KIND.SUBDOMAIN ||
    value === SHORT_URL_KIND.BOTH
  );
}

export function parseShortUrlKind(
  raw: unknown,
  fallback: ShortUrlKind = SHORT_URL_KIND.PATH,
): ShortUrlKind {
  return isShortUrlKind(raw) ? raw : fallback;
}

/** True when the kind includes a vanity subdomain host. */
export function kindHasSubdomain(kind: ShortUrlKind): boolean {
  return kind === SHORT_URL_KIND.SUBDOMAIN || kind === SHORT_URL_KIND.BOTH;
}

/** True when the kind includes an apex path host. */
export function kindHasPath(kind: ShortUrlKind): boolean {
  return kind === SHORT_URL_KIND.PATH || kind === SHORT_URL_KIND.BOTH;
}

/** Mongo `$in` for resolving an apex-path hit. */
export const PATH_HIT_KINDS = [SHORT_URL_KIND.PATH, SHORT_URL_KIND.BOTH] as const;

/** Mongo `$in` for resolving a vanity-subdomain hit. */
export const SUBDOMAIN_HIT_KINDS = [SHORT_URL_KIND.SUBDOMAIN, SHORT_URL_KIND.BOTH] as const;

/** Kinds that conflict with a proposed kind for the same short label. */
export function conflictingKinds(kind: ShortUrlKind): ShortUrlKind[] {
  switch (kind) {
    case SHORT_URL_KIND.PATH:
      return [SHORT_URL_KIND.PATH, SHORT_URL_KIND.BOTH];
    case SHORT_URL_KIND.SUBDOMAIN:
      return [SHORT_URL_KIND.SUBDOMAIN, SHORT_URL_KIND.BOTH];
    case SHORT_URL_KIND.BOTH:
      return [SHORT_URL_KIND.PATH, SHORT_URL_KIND.SUBDOMAIN, SHORT_URL_KIND.BOTH];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function hostsToKind(pathHost: boolean, subdomainHost: boolean): ShortUrlKind {
  if (pathHost && subdomainHost) return SHORT_URL_KIND.BOTH;
  if (subdomainHost) return SHORT_URL_KIND.SUBDOMAIN;
  return SHORT_URL_KIND.PATH;
}
