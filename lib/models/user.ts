import { model, models, Schema, type Model } from "mongoose";

export type UserRole = "owner" | "member";

export type UserAttrs = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<UserAttrs>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["owner", "member"],
      required: true,
      default: "member",
    },
  },
  { timestamps: true },
);

export const User =
  (models.User as Model<UserAttrs> | undefined) ?? model<UserAttrs>("User", userSchema);
