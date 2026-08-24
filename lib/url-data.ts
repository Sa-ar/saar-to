import { revalidateTag, unstable_cache } from "next/cache";
import { connectDB } from "@/lib/db";
import { ShortUrl, type ShortUrlAttrs } from "@/lib/models/short-url";
import { User } from "@/lib/models/user";
import { isOwnerRole } from "@/lib/roles";
import { findAccessibleShortUrl, serializeShortUrl } from "@/lib/urls";
import type { ShortUrlDto } from "@/lib/types";
import { USER_ROLE } from "@/lib/user-role";

export const URLS_CACHE_TAG = "urls";

function viewerKey(userId: string, role: string | null | undefined) {
  return isOwnerRole(role) ? USER_ROLE.OWNER : userId;
}

function toDto(
  doc: ShortUrlAttrs & { _id: { toString(): string } },
  baseUrl: string,
  createdByName?: string | null,
): ShortUrlDto {
  return serializeShortUrl(doc, baseUrl, { createdByName: createdByName ?? null });
}

async function creatorNames(docs: Array<{ userId: { toString(): string } }>, ownerView: boolean) {
  if (!ownerView) {
    return new Map<string, string>();
  }

  const users = await User.find({
    _id: { $in: docs.map((doc) => doc.userId) },
  }).select("name");
  const names = new Map<string, string>();
  for (const user of users) {
    names.set(user._id.toString(), user.name);
  }
  return names;
}

const getCachedUrlList = unstable_cache(
  async (key: string, userId: string, baseUrl: string) => {
    await connectDB();
    const filter = key === USER_ROLE.OWNER ? {} : { userId };
    const docs = await ShortUrl.find(filter).sort({ createdAt: -1 }).lean();
    const names = await creatorNames(docs, key === USER_ROLE.OWNER);
    return docs.map((doc) => toDto(doc, baseUrl, names.get(doc.userId.toString()) ?? null));
  },
  ["url-list"],
  { revalidate: 60, tags: [URLS_CACHE_TAG] },
);

const getCachedUrl = unstable_cache(
  async (id: string, userId: string, role: string, baseUrl: string) => {
    await connectDB();
    const doc = await findAccessibleShortUrl(id, userId, role);
    if (!doc) {
      return null;
    }
    let createdByName: string | null = null;
    if (isOwnerRole(role)) {
      const user = await User.findById(doc.userId).select("name");
      createdByName = user?.name ?? null;
    }
    return toDto(doc, baseUrl, createdByName);
  },
  ["url-one"],
  { revalidate: 60, tags: [URLS_CACHE_TAG] },
);

export function loadUrlList(userId: string, role: string | null | undefined, baseUrl: string) {
  return getCachedUrlList(viewerKey(userId, role), userId, baseUrl);
}

export function loadUrl(
  id: string,
  userId: string,
  role: string | null | undefined,
  baseUrl: string,
) {
  return getCachedUrl(id, userId, role ?? USER_ROLE.MEMBER, baseUrl);
}

export function revalidateUrlCaches() {
  revalidateTag(URLS_CACHE_TAG, { expire: 0 });
}
