import { nanoid } from "nanoid";
import { Invite } from "@/lib/models/invite";
import { getBaseUrl } from "@/lib/urls";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteDto = {
  id: string;
  url: string;
  expiresAt: string;
  createdAt: string;
};

export function serializeInvite(
  doc: {
    _id: { toString(): string };
    token: string;
    expiresAt: Date;
    createdAt: Date;
  },
  baseUrl: string,
): InviteDto {
  return {
    id: doc._id.toString(),
    url: `${baseUrl}/register?invite=${doc.token}`,
    expiresAt: new Date(doc.expiresAt).toISOString(),
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function createInvite(createdBy: string, request?: Request) {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const doc = await Invite.create({
    token,
    createdBy,
    role: "member",
    expiresAt,
  });

  return serializeInvite(doc, getBaseUrl(request));
}

export async function listPendingInvites(createdBy: string, request?: Request) {
  const now = new Date();
  const docs = await Invite.find({
    createdBy,
    usedAt: null,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  const baseUrl = getBaseUrl(request);
  return docs.map((doc) => serializeInvite(doc, baseUrl));
}

export async function findValidInvite(token: string) {
  if (!token.trim()) {
    return null;
  }

  const invite = await Invite.findOne({ token: token.trim() });
  if (!invite) {
    return null;
  }

  if (invite.usedAt) {
    return null;
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return invite;
}

export async function consumeInvite(token: string) {
  if (!token.trim()) {
    return null;
  }

  return Invite.findOneAndUpdate(
    {
      token: token.trim(),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
}
