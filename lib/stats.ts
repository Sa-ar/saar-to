import mongoose from "mongoose";
import { displayCountry, mergeDailySeries, referrerHost } from "@/lib/clicks";
import { isExpired } from "@/lib/dates";
import { ClickEvent } from "@/lib/models/click-event";
import { ShortUrl } from "@/lib/models/short-url";
import { isOwnerRole } from "@/lib/roles";
import type { BreakdownRow, ClickEventDto, LinkClicksDto, StatsOverviewDto } from "@/lib/types";
import type { ShortUrlAttrs } from "@/lib/models/short-url";
import { LIMITS } from "@/lib/limits";

function ownerFilter(userId: string, role: string | null | undefined) {
  if (isOwnerRole(role)) {
    return {};
  }
  return { userId: new mongoose.Types.ObjectId(userId) };
}

function toBreakdown(counts: Map<string, number>, emptyLabel?: string): BreakdownRow[] {
  const rows: BreakdownRow[] = [...counts.entries()].map(([label, count]) => ({
    label: label || emptyLabel || "(unknown)",
    count,
  }));
  rows.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return rows;
}

export async function statsOverview(
  userId: string,
  role: string | null | undefined,
  excludeBots: boolean,
): Promise<StatsOverviewDto> {
  const filter = ownerFilter(userId, role);
  const docs = await ShortUrl.find(filter).select("clicks expiresAt");
  const links = docs.length;
  const active = docs.filter((doc) => !isExpired(doc.expiresAt)).length;

  const eventMatch: Record<string, unknown> = { ...filter };
  if (excludeBots) {
    eventMatch.isBot = false;
  }

  const uniqueVisitors = (await ClickEvent.distinct("visitorKey", eventMatch)).length;

  const clicks = excludeBots
    ? await ClickEvent.countDocuments(eventMatch)
    : docs.reduce((total, doc) => total + doc.clicks, 0);

  return { links, clicks, uniqueVisitors, active };
}

export function serializeClickEvent(event: {
  _id: { toString(): string };
  createdAt: Date;
  ip: string;
  country: string;
  region: string;
  city: string;
  deviceType: string;
  browser: string;
  browserVersion: string;
  os: string;
  referrer: string;
  isBot: boolean;
}): ClickEventDto {
  return {
    id: event._id.toString(),
    createdAt: new Date(event.createdAt).toISOString(),
    ip: event.ip,
    country: event.country,
    region: event.region,
    city: event.city,
    deviceType: event.deviceType,
    browser: event.browser,
    browserVersion: event.browserVersion,
    os: event.os,
    referrerHost: referrerHost(event.referrer),
    isBot: event.isBot,
  };
}

export async function linkClickStats(
  doc: ShortUrlAttrs & { _id: { toString(): string } },
  excludeBots: boolean,
): Promise<LinkClicksDto> {
  const shortUrlId = doc._id;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (LIMITS.STATS_TREND_DAYS - 1));
  since.setUTCHours(0, 0, 0, 0);

  const match: Record<string, unknown> = { shortUrlId };
  if (excludeBots) {
    match.isBot = false;
  }

  const [uniqueVisitors, recent, filteredDaily, anyDaily] = await Promise.all([
    ClickEvent.distinct("visitorKey", match),
    ClickEvent.find(match).sort({ createdAt: -1 }).limit(LIMITS.STATS_RECENT_CLICKS),
    ClickEvent.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
          count: { $sum: 1 },
        },
      },
    ]),
    ClickEvent.aggregate<{ _id: string }>([
      { $match: { shortUrlId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" },
          },
        },
      },
    ]),
  ]);

  const eventCounts = new Map(filteredDaily.map((row) => [row._id, row.count] as const));
  const eventDays = new Set(anyDaily.map((row) => row._id));

  const [countryRows, referrerRows, deviceRows, browserRows] = await Promise.all([
    ClickEvent.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$country", count: { $sum: 1 } } },
    ]),
    ClickEvent.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$referrer", count: { $sum: 1 } } },
    ]),
    ClickEvent.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$deviceType", count: { $sum: 1 } } },
    ]),
    ClickEvent.aggregate<{ _id: string; count: number }>([
      { $match: match },
      { $group: { _id: "$browser", count: { $sum: 1 } } },
    ]),
  ]);

  const countries = new Map<string, number>();
  for (const row of countryRows) {
    const label = displayCountry(row._id ?? "");
    countries.set(label, (countries.get(label) ?? 0) + row.count);
  }

  const referrers = new Map<string, number>();
  for (const row of referrerRows) {
    const label = referrerHost(row._id ?? "");
    referrers.set(label, (referrers.get(label) ?? 0) + row.count);
  }

  const devices = new Map<string, number>();
  for (const row of deviceRows) {
    const label = row._id?.trim() || "(unknown)";
    devices.set(label, (devices.get(label) ?? 0) + row.count);
  }

  const browsers = new Map<string, number>();
  for (const row of browserRows) {
    const label = row._id?.trim() || "(unknown)";
    browsers.set(label, (browsers.get(label) ?? 0) + row.count);
  }

  return {
    uniqueVisitors: uniqueVisitors.length,
    clicks: excludeBots ? await ClickEvent.countDocuments(match) : doc.clicks,
    daily: mergeDailySeries(eventDays, eventCounts, doc.dailyClicks ?? [], LIMITS.STATS_TREND_DAYS),
    breakdowns: {
      country: toBreakdown(countries),
      referrer: toBreakdown(referrers),
      device: toBreakdown(devices),
      browser: toBreakdown(browsers),
    },
    recent: recent.map(serializeClickEvent),
  };
}
