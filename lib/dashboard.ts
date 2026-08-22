import type { ShortUrlDto } from "@/lib/types";

export type LinkStatusFilter = "all" | "active" | "expired";

export function matchesStatus(url: ShortUrlDto, status: LinkStatusFilter) {
  switch (status) {
    case "all":
      return true;
    case "active":
      return !url.expired;
    case "expired":
      return url.expired;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function filterUrls(urls: ShortUrlDto[], search: string, status: LinkStatusFilter) {
  const query = search.trim().toLowerCase();

  return urls.filter((url) => {
    if (!matchesStatus(url, status)) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      url.full.toLowerCase().includes(query) ||
      url.short.toLowerCase().includes(query) ||
      url.shortUrl.toLowerCase().includes(query) ||
      (url.fileName ?? "").toLowerCase().includes(query) ||
      (url.note ?? "").toLowerCase().includes(query)
    );
  });
}
