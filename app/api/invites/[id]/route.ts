import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Invite } from "@/lib/models/invite";
import { HTTP_STATUS } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const ownerId = await requireOwner();
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: HTTP_STATUS.FORBIDDEN });
  }

  const { id } = await context.params;
  await connectDB();

  const result = await Invite.deleteOne({ _id: id, createdBy: ownerId });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Invite not found" }, { status: HTTP_STATUS.NOT_FOUND });
  }

  return NextResponse.json({ ok: true });
}
