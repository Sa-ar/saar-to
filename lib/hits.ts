import { isExpired } from "@/lib/dates";
import { recordClickEvent } from "@/lib/clicks";
import { connectDB } from "@/lib/db";
import {
  PATH_HIT_KINDS,
  SHORT_URL_KIND,
  SUBDOMAIN_HIT_KINDS,
  type PublicHitKind,
} from "@/lib/kinds";
import { ShortUrl, type ShortUrlAttrs } from "@/lib/models/short-url";
import { recordClick } from "@/lib/urls";
import { isReservedSlug } from "@/lib/validations/url";
import type { HydratedDocument } from "mongoose";

export type PublicLinkDoc = HydratedDocument<ShortUrlAttrs>;

export async function resolvePublicHit(
  code: string,
  kind: PublicHitKind,
): Promise<PublicLinkDoc | null> {
  const slug = kind === SHORT_URL_KIND.SUBDOMAIN ? code.toLowerCase() : code;

  if (isReservedSlug(slug)) {
    return null;
  }

  await connectDB();
  const doc =
    kind === SHORT_URL_KIND.SUBDOMAIN
      ? await ShortUrl.findOne({
          short: slug,
          kind: { $in: [...SUBDOMAIN_HIT_KINDS] },
        })
      : await ShortUrl.findOne({
          short: slug,
          kind: { $in: [...PATH_HIT_KINDS] },
        });

  if (!doc || isExpired(doc.expiresAt)) {
    return null;
  }

  return doc;
}

export async function recordPublicHit(request: Request, doc: PublicLinkDoc) {
  recordClick(doc);

  try {
    await doc.save();
  } catch (error) {
    console.error("[hits] aggregate save failed:", error);
  }

  try {
    await recordClickEvent(request, doc);
  } catch (error) {
    console.error("[hits] click event insert failed:", error);
  }
}
