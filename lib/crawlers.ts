const SOCIAL_CRAWLER_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /twitterbot/i,
  /slackbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /discordbot/i,
  /telegrambot/i,
  /pinterest/i,
  /applebot/i,
  /skypeuripreview/i,
  /iframely/i,
  /quora link preview/i,
  /google.*snippet/i,
  /meta-externalagent/i,
];

export type ClientPlatform = "android" | "ios" | "other";

export function getUserAgent(request: Request): string {
  return request.headers.get("user-agent") ?? "";
}

export function isSocialCrawler(userAgent: string): boolean {
  if (userAgent.length === 0) {
    return false;
  }

  return SOCIAL_CRAWLER_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function getClientPlatform(userAgent: string): ClientPlatform {
  const normalized = userAgent.toLowerCase();

  if (normalized.includes("android")) {
    return "android";
  }

  if (normalized.includes("iphone") || normalized.includes("ipad") || normalized.includes("ipod")) {
    return "ios";
  }

  return "other";
}
