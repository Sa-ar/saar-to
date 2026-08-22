import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { consumeInvite } from "@/lib/invites";
import { User } from "@/lib/models/user";
import { isDuplicateKeyError } from "@/lib/urls";
import { registerSchema } from "@/lib/validations/auth";
import { AUTH_ERROR } from "@/lib/link-enums";
import { LIMITS } from "@/lib/limits";
import { USER_ROLE } from "@/lib/user-role";
import { HTTP_STATUS } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: HTTP_STATUS.BAD_REQUEST });
  }

  const inviteToken =
    body && typeof body === "object" && AUTH_ERROR.INVITE in body ? String(body.invite ?? "") : "";

  if (!inviteToken.trim()) {
    return NextResponse.json(
      { error: "Registration requires an invite" },
      { status: HTTP_STATUS.FORBIDDEN },
    );
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    return NextResponse.json({ error: message }, { status: HTTP_STATUS.BAD_REQUEST });
  }

  await connectDB();

  const invite = await consumeInvite(parsed.data.invite);
  if (!invite) {
    return NextResponse.json(
      { error: "Invite is invalid or expired" },
      { status: HTTP_STATUS.BAD_REQUEST },
    );
  }

  try {
    await User.create({
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hash(parsed.data.password, LIMITS.BCRYPT_ROUNDS),
      role: USER_ROLE.MEMBER,
    });
  } catch (error) {
    invite.usedAt = null;
    await invite.save();

    if (isDuplicateKeyError(error)) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: HTTP_STATUS.CONFLICT },
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: HTTP_STATUS.CREATED });
}
