import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { parseExcludeBots } from "@/lib/clicks";
import { connectDB } from "@/lib/db";
import { linkClickStats } from "@/lib/stats";
import { findAccessibleShortUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  await connectDB();
  const doc = await findAccessibleShortUrl(id, session.user.id, session.user.role);

  if (!doc) {
    return NextResponse.json({ error: "Short URL not found" }, { status: 404 });
  }

  const stats = await linkClickStats(doc, parseExcludeBots(request));
  return NextResponse.json(stats);
}
