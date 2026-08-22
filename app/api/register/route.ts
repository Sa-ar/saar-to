import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { consumeInvite } from "@/lib/invites";
import { User } from "@/lib/models/user";
import { isDuplicateKeyError } from "@/lib/urls";
import { registerSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const inviteToken =
    body && typeof body === "object" && "invite" in body
      ? String((body as { invite: unknown }).invite ?? "")
      : "";

  if (!inviteToken.trim()) {
    return NextResponse.json({ error: "Registration requires an invite" }, { status: 403 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await connectDB();

  const invite = await consumeInvite(parsed.data.invite);
  if (!invite) {
    return NextResponse.json({ error: "Invite is invalid or expired" }, { status: 400 });
  }

  try {
    await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hash(parsed.data.password, 12),
      role: "member",
    });
  } catch (error) {
    invite.usedAt = null;
    await invite.save();

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
