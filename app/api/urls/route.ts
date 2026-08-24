import { after, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { ShortUrl } from "@/lib/models/short-url";
import { isOwnerRole } from "@/lib/roles";
import { loadUrlList, revalidateUrlCaches } from "@/lib/url-data";
import {
  getBaseUrl,
  hasSlugCollision,
  isDuplicateKeyError,
  isMongooseValidationError,
  serializeShortUrl,
} from "@/lib/urls";
import { kindHasSubdomain, parseShortUrlKind } from "@/lib/kinds";
import { createUrlSchema } from "@/lib/validations/url";
import { assignFileTarget } from "@/lib/files";
import { hashLinkPassword } from "@/lib/link-gate";
import { ensureVanityDomain } from "@/lib/vercel-domains";
import { refreshShortUrlUnfurlById } from "@/lib/unfurl";
import { FILE_DISPOSITION, FILE_SOURCE, SHORT_URL_TARGET } from "@/lib/link-enums";
import { HTTP_STATUS } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_STATUS.UNAUTHORIZED });
  }

  const urls = await loadUrlList(session.user.id, session.user.role, getBaseUrl(request));

  return NextResponse.json(urls);
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_STATUS.UNAUTHORIZED });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: HTTP_STATUS.BAD_REQUEST });
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const parsed = createUrlSchema.safeParse({
    fullUrl: record.fullUrl,
    slug: String(record.slug ?? ""),
    expiresAt: String(record.expiresAt ?? ""),
    kind: parseShortUrlKind(record.kind),
    target: record.target === SHORT_URL_TARGET.FILE ? SHORT_URL_TARGET.FILE : SHORT_URL_TARGET.URL,
    disposition:
      record.disposition === FILE_DISPOSITION.ATTACHMENT
        ? FILE_DISPOSITION.ATTACHMENT
        : FILE_DISPOSITION.INLINE,
    fileName: String(record.fileName ?? ""),
    contentType: String(record.contentType ?? ""),
    fileSize: typeof record.fileSize === "number" ? record.fileSize : undefined,
    fileSource:
      record.fileSource === FILE_SOURCE.BLOB || record.fileSource === FILE_SOURCE.EXTERNAL
        ? record.fileSource
        : undefined,
    note: String(record.note ?? ""),
    password: String(record.password ?? ""),
    ogTitle: String(record.ogTitle ?? ""),
    ogDescription: String(record.ogDescription ?? ""),
    ogImageUrl: String(record.ogImageUrl ?? ""),
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: HTTP_STATUS.BAD_REQUEST });
  }

  if (kindHasSubdomain(parsed.data.kind) && !isOwnerRole(session.user.role)) {
    return NextResponse.json(
      { error: "Only owners can create premium subdomain links" },
      { status: HTTP_STATUS.FORBIDDEN },
    );
  }

  if (kindHasSubdomain(parsed.data.kind) && !parsed.data.slug) {
    return NextResponse.json(
      { error: "Subdomain is required" },
      { status: HTTP_STATUS.BAD_REQUEST },
    );
  }

  await connectDB({ waitForEnsure: true });

  if (parsed.data.slug && (await hasSlugCollision(parsed.data.slug, parsed.data.kind))) {
    return NextResponse.json(
      {
        error: kindHasSubdomain(parsed.data.kind)
          ? "That subdomain or path is already taken"
          : "That slug is already taken",
      },
      { status: HTTP_STATUS.CONFLICT },
    );
  }

  try {
    const doc = await ShortUrl.create({
      userId: session.user.id,
      full: parsed.data.fullUrl,
      kind: parsed.data.kind,
      target: parsed.data.target,
      ...(parsed.data.slug ? { short: parsed.data.slug } : {}),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    assignFileTarget(doc, parsed.data);
    if (parsed.data.note) {
      doc.note = parsed.data.note;
    }
    doc.ogTitle = parsed.data.ogTitle ?? null;
    doc.ogDescription = parsed.data.ogDescription ?? null;
    doc.ogImageUrl = parsed.data.ogImageUrl ?? null;
    if (parsed.data.password) {
      doc.passwordHash = await hashLinkPassword(parsed.data.password);
    }
    await doc.save();

    let domainWarning: string | undefined;
    if (kindHasSubdomain(parsed.data.kind) && parsed.data.slug) {
      const domainResult = await ensureVanityDomain(parsed.data.slug);
      if (!domainResult.ok) {
        domainWarning = domainResult.error;
      } else if (!domainResult.provisioned) {
        domainWarning =
          "Domain not provisioned automatically. Add it in Vercel → Domains, or set VERCEL_TOKEN.";
      }
    }

    const dto = serializeShortUrl(doc, getBaseUrl(request));
    after(async () => {
      if (doc.target === SHORT_URL_TARGET.URL) {
        await refreshShortUrlUnfurlById(doc._id.toString());
      }
    });
    revalidateUrlCaches();
    return NextResponse.json(domainWarning ? { ...dto, domainWarning } : dto, {
      status: HTTP_STATUS.CREATED,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        {
          error: kindHasSubdomain(parsed.data.kind)
            ? "That subdomain is already taken"
            : "That slug is already taken",
        },
        { status: HTTP_STATUS.CONFLICT },
      );
    }

    if (isMongooseValidationError(error)) {
      return NextResponse.json({ error: error.message }, { status: HTTP_STATUS.BAD_REQUEST });
    }

    throw error;
  }
}
