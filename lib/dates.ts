import { LIMITS } from "@/lib/limits";
import { MS_PER_DAY } from "@/lib/time";
import type { DailyClick } from "@/lib/types";

export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, LIMITS.ISO_DATE_LENGTH);
}

export function isExpired(expiresAt?: Date | string | null) {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= Date.now();
}

const EXPIRING_SOON_WINDOW_MS = MS_PER_DAY;

/** True when a link has an expiry within the next 24h (and hasn't expired). */
export function isExpiringSoon(
  expiresAt?: Date | string | null,
  windowMs = EXPIRING_SOON_WINDOW_MS,
) {
  if (!expiresAt) {
    return false;
  }

  const time = new Date(expiresAt).getTime();
  const now = Date.now();
  return time > now && time - now <= windowMs;
}

export function lastNDays(dailyClicks: DailyClick[], days = 14) {
  const counts = new Map(dailyClicks.map((entry) => [entry.date, entry.count]));
  const result: DailyClick[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    const key = utcDateString(date);
    result.push({ date: key, count: counts.get(key) ?? 0 });
  }

  return result;
}
