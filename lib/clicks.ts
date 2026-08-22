import { createHash } from "node:crypto";
import type { Types } from "mongoose";
import { UAParser } from "ua-parser-js";
import { isBot as uaIsBot } from "ua-parser-js/bot-detection";
import { Bots } from "ua-parser-js/extensions";
import { utcDateString } from "@/lib/dates";
import { ClickEvent } from "@/lib/models/click-event";
import type { ShortUrlAttrs } from "@/lib/models/short-url";
import type { DailyClick } from "@/lib/types";

const HEADER_MAX = 1000;

function truncate(value: string) {
  if (value.length <= HEADER_MAX) {
    return value;
  }
  return value.slice(0, HEADER_MAX);
}

function header(request: Request, name: string) {
  return truncate(request.headers.get(name) ?? "");
}

export function clientIp(request: Request) {
  const forwarded = header(request, "x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return header(request, "x-real-ip");
}

export function visitorKey(ip: string, userAgent: string) {
  return createHash("sha256").update(`${ip}\n${userAgent}`).digest("hex").slice(0, 32);
}

function parseUserAgent(userAgent: string) {
  const result = UAParser(userAgent, Bots);
  const deviceType = result.device.type?.trim() || "desktop";

  return {
    browser: result.browser.name ?? "",
    browserVersion: result.browser.version ?? "",
    os: result.os.name ?? "",
    osVersion: result.os.version ?? "",
    deviceType,
    isBot: uaIsBot(result) || uaIsBot(userAgent),
  };
}

export function parseClickRequest(request: Request) {
  const ip = clientIp(request);
  const userAgent = header(request, "user-agent");
  const parsed = parseUserAgent(userAgent);

  return {
    ip,
    userAgent,
    referrer: header(request, "referer"),
    acceptLanguage: header(request, "accept-language"),
    country: header(request, "x-vercel-ip-country") || header(request, "cf-ipcountry"),
    region: header(request, "x-vercel-ip-country-region"),
    city: header(request, "x-vercel-ip-city"),
    ...parsed,
    visitorKey: visitorKey(ip, userAgent),
  };
}

export async function recordClickEvent(
  request: Request,
  doc: Pick<ShortUrlAttrs, "userId" | "short"> & { _id: Types.ObjectId },
) {
  const parsed = parseClickRequest(request);
  await ClickEvent.create({
    shortUrlId: doc._id,
    userId: doc.userId,
    short: doc.short,
    ...parsed,
  });
}

export function referrerHost(referrer: string) {
  const value = referrer.trim();
  if (!value) {
    return "(direct)";
  }

  try {
    const host = new URL(value).hostname.trim();
    return host || "(direct)";
  } catch {
    return "(direct)";
  }
}

export function displayCountry(country: string) {
  return country.trim() || "(unknown)";
}

export function parseExcludeBots(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get("excludeBots") === "true";
}

export function mergeDailySeries(
  eventDays: Set<string>,
  eventCounts: Map<string, number>,
  legacy: DailyClick[],
  days = 14,
): DailyClick[] {
  const legacyMap = new Map(legacy.map((entry) => [entry.date, entry.count]));
  const result: DailyClick[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const key = utcDateString(date);

    if (eventDays.has(key)) {
      result.push({ date: key, count: eventCounts.get(key) ?? 0 });
    } else {
      result.push({ date: key, count: legacyMap.get(key) ?? 0 });
    }
  }

  return result;
}
