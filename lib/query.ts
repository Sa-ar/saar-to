import type { QueryClient } from "@tanstack/react-query";
import type { ShortUrlDto } from "@/lib/types";

export const urlsQueryKey = ["urls"] as const;
export const overviewStatsQueryKey = (excludeBots: boolean) =>
  ["overview-stats", excludeBots] as const;
export const urlQueryKey = (id: string) => ["url", id] as const;
export const urlClicksQueryKey = (id: string, excludeBots: boolean) =>
  ["url-clicks", id, excludeBots] as const;

export const QUERY_STALE_TIME_MS = 5 * 60 * 1000;
export const QUERY_GC_TIME_MS = 30 * 60 * 1000;
export const QUERY_PERSIST_KEY = "saar-to.query-cache";

export function seedUrlCaches(queryClient: QueryClient, urls: ShortUrlDto[]) {
  for (const url of urls) {
    const key = urlQueryKey(url.id);
    if (!queryClient.getQueryData(key)) {
      queryClient.setQueryData(key, url);
    }
  }
}

export function upsertUrlInCache(queryClient: QueryClient, saved: ShortUrlDto) {
  queryClient.setQueryData(urlQueryKey(saved.id), saved);
  queryClient.setQueryData(urlsQueryKey, (old: ShortUrlDto[] | undefined) => {
    if (!old) {
      return [saved];
    }
    const index = old.findIndex((item) => item.id === saved.id);
    if (index === -1) {
      return [saved, ...old];
    }
    const next = old.slice();
    next[index] = saved;
    return next;
  });
}

export function removeUrlFromCache(queryClient: QueryClient, id: string) {
  queryClient.removeQueries({ queryKey: urlQueryKey(id) });
  queryClient.setQueryData(urlsQueryKey, (old: ShortUrlDto[] | undefined) =>
    old?.filter((item) => item.id !== id),
  );
}
