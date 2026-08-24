export type DailyClick = {
  date: string;
  count: number;
};

import type { ShortUrlKind } from "@/lib/kinds";
import type { FileDisposition, FileSource, ShortUrlTarget } from "@/lib/link-enums";

export type { ShortUrlKind };
export type { FileDisposition, FileSource, ShortUrlTarget };

export type BreakdownRow = {
  label: string;
  count: number;
};

export type ClickEventDto = {
  id: string;
  createdAt: string;
  ip: string;
  country: string;
  region: string;
  city: string;
  deviceType: string;
  browser: string;
  browserVersion: string;
  os: string;
  referrerHost: string;
  isBot: boolean;
};

export type StatsOverviewDto = {
  links: number;
  clicks: number;
  uniqueVisitors: number;
  active: number;
};

export type LinkClicksDto = {
  uniqueVisitors: number;
  clicks: number;
  daily: DailyClick[];
  breakdowns: {
    country: BreakdownRow[];
    referrer: BreakdownRow[];
    device: BreakdownRow[];
    browser: BreakdownRow[];
  };
  recent: ClickEventDto[];
};

export type ShortUrlDto = {
  id: string;
  full: string;
  short: string;
  /** Primary short URL (vanity when subdomain is enabled). */
  shortUrl: string;
  /** Apex path URL when the link is served on saar.to/slug (path or both). */
  pathUrl: string | null;
  kind: ShortUrlKind;
  target: ShortUrlTarget;
  disposition: FileDisposition | null;
  fileName: string | null;
  contentType: string | null;
  fileSize: number | null;
  fileSource: FileSource | null;
  note: string | null;
  createdByName: string | null;
  hasPassword: boolean;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  clicks: number;
  expiresAt: string | null;
  lastAccessedAt: string | null;
  dailyClicks: DailyClick[];
  createdAt: string;
  updatedAt: string;
  expired: boolean;
  /** Present when a vanity domain could not be auto-provisioned. */
  domainWarning?: string;
};

export type CreateUrlBody = {
  fullUrl: string;
  slug?: string;
  expiresAt?: string;
  kind?: ShortUrlKind;
  target?: ShortUrlTarget;
  disposition?: FileDisposition;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  fileSource?: FileSource;
  note?: string;
  password?: string;
  removePassword?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
};

export type UpdateUrlBody = {
  fullUrl: string;
  slug: string;
  expiresAt?: string;
  kind?: ShortUrlKind;
  target?: ShortUrlTarget;
  disposition?: FileDisposition;
  fileName?: string;
  contentType?: string;
  fileSize?: number;
  fileSource?: FileSource;
  note?: string;
  password?: string;
  removePassword?: boolean;
  ogTitle?: string;
  ogDescription?: string;
  ogImageUrl?: string;
};
