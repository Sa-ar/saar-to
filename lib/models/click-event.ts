import { model, models, Schema, type Model, type Types } from "mongoose";

export type ClickEventAttrs = {
  shortUrlId: Types.ObjectId;
  userId: Types.ObjectId;
  short: string;
  ip: string;
  userAgent: string;
  referrer: string;
  acceptLanguage: string;
  country: string;
  region: string;
  city: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: string;
  isBot: boolean;
  visitorKey: string;
  createdAt: Date;
};

const clickEventSchema = new Schema<ClickEventAttrs>(
  {
    shortUrlId: {
      type: Schema.Types.ObjectId,
      ref: "ShortUrl",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    short: { type: String, required: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    referrer: { type: String, default: "" },
    acceptLanguage: { type: String, default: "" },
    country: { type: String, default: "" },
    region: { type: String, default: "" },
    city: { type: String, default: "" },
    browser: { type: String, default: "" },
    browserVersion: { type: String, default: "" },
    os: { type: String, default: "" },
    osVersion: { type: String, default: "" },
    deviceType: { type: String, default: "" },
    isBot: { type: Boolean, required: true, default: false, index: true },
    visitorKey: { type: String, required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

clickEventSchema.index({ shortUrlId: 1, createdAt: -1 });
clickEventSchema.index({ userId: 1, isBot: 1, visitorKey: 1 });
clickEventSchema.index({ shortUrlId: 1, isBot: 1, createdAt: -1 });

export const ClickEvent =
  (models.ClickEvent as Model<ClickEventAttrs> | undefined) ??
  model<ClickEventAttrs>("ClickEvent", clickEventSchema);
