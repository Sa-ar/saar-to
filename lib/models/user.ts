import { model, models, Schema, type Model } from "mongoose";
import { USER_ROLE, type UserRole } from "@/lib/user-role";

export type { UserRole };

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
      enum: [USER_ROLE.OWNER, USER_ROLE.MEMBER],
      required: true,
      default: USER_ROLE.MEMBER,
    },
  },
  { timestamps: true },
);

export const User =
  (models.User as Model<UserAttrs> | undefined) ?? model<UserAttrs>("User", userSchema);
