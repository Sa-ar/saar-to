import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from "undici";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal", "metadata"]);

export type SafeOutboundTarget = {
  url: URL;
  /** Address used for the TCP connection (DNS-pinned). */
  address: string;
  family: 4 | 6;
};

function ipv4ToInt(address: string) {
  return (
    address
      .split(".")
      .map((part) => Number(part))
      .reduce((value, part) => (value << 8) + part, 0) >>> 0
  );
}

function isIpv4InCidr(address: string, base: string, prefix: number) {
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipv4ToInt(address) & mask) === (ipv4ToInt(base) & mask);
}

function isBlockedIpv4(address: string) {
  return (
    isIpv4InCidr(address, "0.0.0.0", 8) ||
    isIpv4InCidr(address, "10.0.0.0", 8) ||
    isIpv4InCidr(address, "100.64.0.0", 10) ||
    isIpv4InCidr(address, "127.0.0.0", 8) ||
    isIpv4InCidr(address, "169.254.0.0", 16) ||
    isIpv4InCidr(address, "172.16.0.0", 12) ||
    isIpv4InCidr(address, "192.0.0.0", 24) ||
    isIpv4InCidr(address, "192.0.2.0", 24) ||
    isIpv4InCidr(address, "192.88.99.0", 24) ||
    isIpv4InCidr(address, "192.168.0.0", 16) ||
    isIpv4InCidr(address, "198.18.0.0", 15) ||
    isIpv4InCidr(address, "198.51.100.0", 24) ||
    isIpv4InCidr(address, "203.0.113.0", 24) ||
    isIpv4InCidr(address, "224.0.0.0", 4)
  );
}

/** Decode ::ffff:7f00:1-style hex mapped IPv4 into dotted decimal. */
function parseHexMappedIpv4(mapped: string): string | null {
  const parts = mapped.split(":");
  if (parts.length !== 2) {
    return null;
  }

  const high = Number.parseInt(parts[0] ?? "", 16);
  const low = Number.parseInt(parts[1] ?? "", 16);
  if (
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    high < 0 ||
    low < 0 ||
    high > 0xffff ||
    low > 0xffff
  ) {
    return null;
  }

  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

function extractMappedIpv4(address: string): string | null {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");

  // Dotted form: ::ffff:127.0.0.1 or 0:0:0:0:0:ffff:127.0.0.1
  const dotted = normalized.match(/(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted?.[1] && isIP(dotted[1]) === 4) {
    return dotted[1];
  }

  // Hex form used by AAAA records: ::ffff:7f00:1 / ::ffff:a9fe:a9fe
  const hex = normalized.match(/(?:^|:)ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    return parseHexMappedIpv4(`${hex[1]}:${hex[2]}`);
  }

  // Deprecated IPv4-compatible form ::a.b.c.d (not ::ffff:)
  if (normalized.startsWith("::") && !normalized.includes(":ffff:") && normalized.includes(".")) {
    const mapped = normalized.slice(2);
    return isIP(mapped) === 4 ? mapped : null;
  }

  return null;
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");

  // Any IPv4-mapped form must be judged as its embedded IPv4. Unparseable
  // mapped addresses are blocked rather than treated as safe public IPv6.
  if (/(?:^|:)ffff:/i.test(normalized)) {
    const mappedIpv4 = extractMappedIpv4(normalized);
    return mappedIpv4 ? isBlockedIpv4(mappedIpv4) : true;
  }

  const mappedIpv4 = extractMappedIpv4(normalized);
  if (mappedIpv4) {
    return isBlockedIpv4(mappedIpv4);
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

function isBlockedIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return isBlockedIpv4(address);
  }

  if (version === 6) {
    return isBlockedIpv6(address);
  }

  return false;
}

/** Resolve and validate an outbound URL, pinning a single safe address for connect. */
export async function resolveSafeOutboundUrl(input: URL): Promise<SafeOutboundTarget> {
  if (!ALLOWED_PROTOCOLS.has(input.protocol)) {
    throw new Error("Only http(s) URLs are allowed");
  }

  const hostname = input.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    throw new Error("Blocked hostname");
  }

  if (isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error("Blocked IP address");
    }
    return {
      url: input,
      address: hostname,
      family: isIP(hostname) === 6 ? 6 : 4,
    };
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) {
    throw new Error("Hostname did not resolve");
  }

  for (const address of addresses) {
    if (isBlockedIp(address.address)) {
      throw new Error("Blocked resolved IP address");
    }
  }

  const pinned = addresses[0];
  if (!pinned) {
    throw new Error("Hostname did not resolve");
  }

  return {
    url: input,
    address: pinned.address,
    family: pinned.family === 6 ? 6 : 4,
  };
}

export async function assertSafeOutboundUrl(input: URL) {
  await resolveSafeOutboundUrl(input);
}

/**
 * Fetch using a dispatcher whose DNS lookup always returns the pinned address,
 * so a rebinding hostname cannot change the peer between check and connect.
 */
export function fetchPinned(target: SafeOutboundTarget, init?: UndiciRequestInit) {
  const dispatcher = new Agent({
    connect: {
      lookup(_hostname, _options, callback) {
        callback(null, target.address, target.family);
      },
    },
  });

  return undiciFetch(target.url, {
    ...init,
    dispatcher,
  });
}
