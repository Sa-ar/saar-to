import { model, models, Schema, type Model, type Types } from "mongoose";

export type InviteAttrs = {
  token: string;
  createdBy: Types.ObjectId;
  role: "member";
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const inviteSchema = new Schema<InviteAttrs>(
  {
    token: { type: String, required: true, unique: true, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["member"],
      required: true,
      default: "member",
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Invite =
  (models.Invite as Model<InviteAttrs> | undefined) ?? model<InviteAttrs>("Invite", inviteSchema);
