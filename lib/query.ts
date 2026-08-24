import type { QueryClient } from "@tanstack/react-query";
import type { ShortUrlDto } from "@/lib/types";

export const QUERY_SCOPE = {
  URLS: "urls",
  OVERVIEW_STATS: "overview-stats",
  URL: "url",
  URL_CLICKS: "url-clicks",
} as const;

export const urlsQueryKey = [QUERY_SCOPE.URLS] as const;
export const overviewStatsQueryKey = (excludeBots: boolean) =>
  [QUERY_SCOPE.OVERVIEW_STATS, excludeBots] as const;
export const urlQueryKey = (id: string) => [QUERY_SCOPE.URL, id] as const;
export const urlClicksQueryKey = (id: string, excludeBots: boolean) =>
  [QUERY_SCOPE.URL_CLICKS, id, excludeBots] as const;

export { QUERY_GC_TIME_MS, QUERY_STALE_TIME_MS } from "@/lib/limits";
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
