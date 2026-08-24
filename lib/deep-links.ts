import type { ShortUrlMetaTag } from "@/lib/models/short-url";

const YOUTUBE_PATH = {
  SHORTS: "shorts",
  LIVE: "live",
} as const;

const SPOTIFY_RESOURCE = {
  TRACK: "track",
  ALBUM: "album",
  PLAYLIST: "playlist",
  ARTIST: "artist",
  SHOW: "show",
  EPISODE: "episode",
} as const;

const TWITTER_PATH = {
  STATUS: "status",
} as const;

export type DeepLinkMatch = {
  iosUrl?: string;
  androidIntentUrl?: string;
  appLinks: ShortUrlMetaTag[];
};

type AppLinkOptions = {
  appName: string;
  iosUrl?: string;
  androidUrl?: string;
  androidPackage?: string;
  appStoreId?: string;
  fallbackUrl: string;
};

/** Intent extras are `;`-delimited; encode `;` in the hierarchical part. */
function encodeIntentSegment(value: string) {
  return value.replace(/;/g, "%3B");
}

function buildAndroidIntentUrl(url: URL, packageName: string) {
  const scheme = url.protocol.replace(/:$/, "");
  const path = [
    url.hostname,
    encodeIntentSegment(url.pathname),
    encodeIntentSegment(url.search),
    encodeIntentSegment(url.hash),
  ].join("");
  const fallback = encodeURIComponent(url.toString());
  return `intent://${path}#Intent;scheme=${scheme};package=${packageName};S.browser_fallback_url=${fallback};end`;
}

function buildAppLinks(options: AppLinkOptions): ShortUrlMetaTag[] {
  const tags: ShortUrlMetaTag[] = [];

  if (options.iosUrl && options.appStoreId) {
    tags.push(
      { key: "al:ios:url", value: options.iosUrl },
      { key: "al:ios:app_store_id", value: options.appStoreId },
      { key: "al:ios:app_name", value: options.appName },
      {
        key: "apple-itunes-app",
        value: `app-id=${options.appStoreId}, app-argument=${options.fallbackUrl}`,
      },
    );
  }

  if (options.androidUrl && options.androidPackage) {
    tags.push(
      { key: "al:android:url", value: options.androidUrl },
      { key: "al:android:package", value: options.androidPackage },
      { key: "al:android:app_name", value: options.appName },
    );
  }

  tags.push({ key: "al:web:url", value: options.fallbackUrl });
  return tags;
}

function matchYouTube(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  let videoId = "";

  if (hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (hostname.endsWith("youtube.com")) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v") ?? "";
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === YOUTUBE_PATH.SHORTS || parts[0] === YOUTUBE_PATH.LIVE) {
        videoId = parts[1] ?? "";
      }
    }
  }

  if (!videoId) {
    return null;
  }

  const iosUrl = `youtube://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const androidPackage = "com.google.android.youtube";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "YouTube",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "544007664",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchSpotify(url: URL): DeepLinkMatch | null {
  if (url.hostname.toLowerCase() !== "open.spotify.com") {
    return null;
  }

  const [resource, id] = url.pathname.split("/").filter(Boolean);
  if (!resource || !id) {
    return null;
  }

  const supported = new Set<string>(Object.values(SPOTIFY_RESOURCE));
  if (!supported.has(resource)) {
    return null;
  }

  const iosUrl = `spotify:${resource}:${id}`;
  const androidPackage = "com.spotify.music";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "Spotify",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "324684580",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchTwitter(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "x.com" && hostname !== "twitter.com" && hostname !== "www.twitter.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const screenName = parts[0];
  const tweetId = parts[1] === TWITTER_PATH.STATUS ? parts[2] : undefined;
  const iosUrl =
    tweetId && screenName
      ? `twitter://status?id=${encodeURIComponent(tweetId)}`
      : screenName
        ? `twitter://user?screen_name=${encodeURIComponent(screenName)}`
        : undefined;

  if (!iosUrl) {
    return null;
  }

  const androidPackage = "com.twitter.android";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "X",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "333903271",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchInstagram(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "instagram.com" && hostname !== "www.instagram.com") {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) {
    return null;
  }

  const username = parts[0];
  if (!username) {
    return null;
  }

  const iosUrl = `instagram://user?username=${encodeURIComponent(username)}`;
  const androidPackage = "com.instagram.android";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "Instagram",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "389801252",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchWhatsApp(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "wa.me" && hostname !== "api.whatsapp.com") {
    return null;
  }

  const text = url.searchParams.get("text");
  const phone = url.pathname.split("/").filter(Boolean)[0] ?? "";
  const query = text ? `?text=${encodeURIComponent(text)}` : phone ? `?phone=${phone}` : "";
  const iosUrl = `whatsapp://send${query}`;
  const androidPackage = "com.whatsapp";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "WhatsApp",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "310633997",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchTelegram(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "t.me" && hostname !== "telegram.me") {
    return null;
  }

  const path = url.pathname.replace(/^\/+/, "");
  if (!path) {
    return null;
  }

  const iosUrl = `tg://resolve?domain=${encodeURIComponent(path.split("/")[0] ?? "")}`;
  const androidPackage = "org.telegram.messenger";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "Telegram",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "686449807",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchReddit(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "reddit.com" && hostname !== "www.reddit.com") {
    return null;
  }

  const iosUrl = `reddit://www.reddit.com${url.pathname}${url.search}${url.hash}`;
  const androidPackage = "com.reddit.frontpage";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "Reddit",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "1064216828",
      fallbackUrl: url.toString(),
    }),
  };
}

function matchLinkedIn(url: URL): DeepLinkMatch | null {
  const hostname = url.hostname.toLowerCase();
  if (hostname !== "linkedin.com" && hostname !== "www.linkedin.com") {
    return null;
  }

  const iosUrl = `linkedin://in/${url.pathname.replace(/^\/+/, "")}`;
  const androidPackage = "com.linkedin.android";
  return {
    iosUrl,
    androidIntentUrl: buildAndroidIntentUrl(url, androidPackage),
    appLinks: buildAppLinks({
      appName: "LinkedIn",
      iosUrl,
      androidUrl: url.toString(),
      androidPackage,
      appStoreId: "288429040",
      fallbackUrl: url.toString(),
    }),
  };
}

const MATCHERS = [
  matchYouTube,
  matchSpotify,
  matchTwitter,
  matchInstagram,
  matchWhatsApp,
  matchTelegram,
  matchReddit,
  matchLinkedIn,
];

export function getDeepLinkMatch(input: string | URL): DeepLinkMatch | null {
  const url = input instanceof URL ? input : new URL(input);

  for (const match of MATCHERS) {
    const result = match(url);
    if (result) {
      return result;
    }
  }

  return null;
}
