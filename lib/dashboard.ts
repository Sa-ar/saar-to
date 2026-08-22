import type { ShortUrlDto } from "@/lib/types";
import { LINK_STATUS_FILTER, type LinkStatusFilter } from "@/lib/link-enums";

export type { LinkStatusFilter };

export function matchesStatus(url: ShortUrlDto, status: LinkStatusFilter) {
  switch (status) {
    case LINK_STATUS_FILTER.ALL:
      return true;
    case LINK_STATUS_FILTER.ACTIVE:
      return !url.expired;
    case LINK_STATUS_FILTER.EXPIRED:
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
