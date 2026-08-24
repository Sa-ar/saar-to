import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { createInvite, listPendingInvites } from "@/lib/invites";
import { HTTP_STATUS } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ownerId = await requireOwner();
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: HTTP_STATUS.FORBIDDEN });
  }

  await connectDB();
  const invites = await listPendingInvites(ownerId, request);
  return NextResponse.json(invites);
}

export async function POST(request: Request) {
  const ownerId = await requireOwner();
  if (!ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: HTTP_STATUS.FORBIDDEN });
  }

  await connectDB();
  const invite = await createInvite(ownerId, request);
  return NextResponse.json(invite, { status: HTTP_STATUS.CREATED });
}
