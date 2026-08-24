import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { parseExcludeBots } from "@/lib/clicks";
import { connectDB } from "@/lib/db";
import { statsOverview } from "@/lib/stats";
import { HTTP_STATUS } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: HTTP_STATUS.UNAUTHORIZED });
  }

  await connectDB();
  const overview = await statsOverview(
    session.user.id,
    session.user.role,
    parseExcludeBots(request),
  );

  return NextResponse.json(overview);
}
