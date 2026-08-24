import { NextResponse } from "next/server";
import { getClientPlatform, getUserAgent } from "@/lib/crawlers";
import { getDeepLinkMatch } from "@/lib/deep-links";
import { serveFile } from "@/lib/files";
import { recordPublicHit, resolvePublicHit } from "@/lib/hits";
import {
  needsPassword,
  setUnlockCookie,
  unlockActionPath,
  unlockPage,
  verifyLinkPassword,
} from "@/lib/link-gate";
import { hasCustomOg, isPreviewCrawler, ogPage } from "@/lib/og";
import { getApexOrigin, vanityShortUrl } from "@/lib/hosts";
import { SHORT_URL_KIND, type PublicHitKind } from "@/lib/kinds";
import { shortUrlTarget } from "@/lib/urls";
import { isUnfurlStale, refreshShortUrlUnfurl } from "@/lib/unfurl";
import { SHORT_URL_TARGET, DEVICE_PLATFORM } from "@/lib/link-enums";
import { HTTP_METHOD, HTTP_STATUS } from "@/lib/http";

function canonicalUrl(kind: PublicHitKind, code: string) {
  return kind === SHORT_URL_KIND.SUBDOMAIN
    ? vanityShortUrl(code)
    : `${getApexOrigin()}/${encodeURIComponent(code)}`;
}

function redirectTo(location: string, status = HTTP_STATUS.FOUND) {
  return new Response(null, {
    status,
    headers: { location },
  });
}

async function getPreviewUnfurl(doc: Awaited<ReturnType<typeof resolvePublicHit>>) {
  if (!doc) {
    return null;
  }

  if (!isUnfurlStale(doc.unfurl)) {
    return doc.unfurl;
  }

  try {
    return await refreshShortUrlUnfurl(doc, { timeoutMs: 2_500 });
  } catch {
    return null;
  }
}

/** Embed a string in an HTML <script> without letting </script> close the tag early. */
function jsonForInlineScript(value: string) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildIosTrampolineScript(appUrl: string, fallbackUrl: string) {
  const app = jsonForInlineScript(appUrl);
  const fallback = jsonForInlineScript(fallbackUrl);

  return `
let leftPage = false;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    leftPage = true;
  }
});
window.location.replace(${app});
setTimeout(() => {
  if (!leftPage) {
    window.location.replace(${fallback});
  }
}, 800);
`.trim();
}

export async function handlePublicRequest(request: Request, code: string, kind: PublicHitKind) {
  const doc = await resolvePublicHit(code, kind);
  if (!doc) {
    return null;
  }

  const label = kind === SHORT_URL_KIND.SUBDOMAIN ? `${doc.short}.saar.to` : `saar.to/${doc.short}`;
  const action = unlockActionPath(kind, doc.short);
  const canonical = canonicalUrl(kind, doc.short);

  if (request.method === HTTP_METHOD.POST) {
    if (!doc.passwordHash) {
      return NextResponse.redirect(canonical, HTTP_STATUS.SEE_OTHER);
    }

    const form = await request.formData().catch(() => null);
    const password = String(form?.get("password") ?? "");
    const ok = password ? await verifyLinkPassword(doc.passwordHash, password) : false;

    if (!ok) {
      return unlockPage(label, action, true);
    }

    const redirectTarget = canonical;
    const response = NextResponse.redirect(redirectTarget, HTTP_STATUS.SEE_OTHER);
    setUnlockCookie(response, doc._id.toString());
    return response;
  }

  if (request.method === HTTP_METHOD.HEAD) {
    return new Response(null, { status: HTTP_STATUS.OK });
  }

  const locked = needsPassword(doc, request);
  const preview = isPreviewCrawler(request);
  const target = shortUrlTarget(doc);
  const deepLinkMatch = target === SHORT_URL_TARGET.URL ? getDeepLinkMatch(doc.full) : null;

  // Locked links: crawlers get safe placeholder OG only — never destination
  // App Links, forwarded unfurl, or deep-link metadata.
  if (preview && locked) {
    return ogPage(doc, canonical);
  }

  if (preview && hasCustomOg(doc)) {
    return ogPage(doc, canonical, { extraAppLinks: deepLinkMatch?.appLinks });
  }

  if (preview && target === SHORT_URL_TARGET.URL) {
    const unfurl = await getPreviewUnfurl(doc);
    if (unfurl) {
      return ogPage(doc, canonical, {
        forwardedUnfurl: unfurl,
        extraAppLinks: deepLinkMatch?.appLinks,
      });
    }

    return redirectTo(doc.full);
  }

  if (locked) {
    return unlockPage(label, action);
  }

  if (target === SHORT_URL_TARGET.URL) {
    const platform = getClientPlatform(getUserAgent(request));
    if (deepLinkMatch?.androidIntentUrl && platform === DEVICE_PLATFORM.ANDROID) {
      await recordPublicHit(request, doc);
      return redirectTo(deepLinkMatch.androidIntentUrl);
    }

    if (deepLinkMatch?.iosUrl && platform === DEVICE_PLATFORM.IOS) {
      await recordPublicHit(request, doc);
      return ogPage(doc, canonical, {
        extraAppLinks: deepLinkMatch.appLinks,
        script: buildIosTrampolineScript(deepLinkMatch.iosUrl, doc.full),
      });
    }
  }

  await recordPublicHit(request, doc);

  if (target === SHORT_URL_TARGET.FILE) {
    return serveFile(doc);
  }

  return NextResponse.redirect(doc.full, HTTP_STATUS.FOUND);
}
