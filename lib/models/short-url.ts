import { model, models, Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import { nanoid } from "nanoid";
import { SHORT_URL_KIND, SHORT_URL_KIND_VALUES, type ShortUrlKind } from "@/lib/kinds";

export type { ShortUrlKind } from "@/lib/kinds";

export type DailyClick = {
  date: string;
  count: number;
};

export type ShortUrlTarget = "url" | "file";
export type FileDisposition = "inline" | "attachment";
export type FileSource = "blob" | "external";

export type ShortUrlMetaTag = {
  key: string;
  value: string;
};

export type ShortUrlUnfurl = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  imageWidth?: string | null;
  imageHeight?: string | null;
  siteName?: string | null;
  type?: string | null;
  twitterCard?: string | null;
  video?: string | null;
  videoSecureUrl?: string | null;
  videoType?: string | null;
  appLinks: ShortUrlMetaTag[];
  finalUrl?: string | null;
  fetchedAt?: Date | null;
};

export type ShortUrlAttrs = {
  userId: Types.ObjectId;
  full: string;
  short: string;
  kind: ShortUrlKind;
  target: ShortUrlTarget;
  disposition?: FileDisposition | null;
  fileName?: string | null;
  contentType?: string | null;
  fileSize?: number | null;
  fileSource?: FileSource | null;
  note?: string | null;
  passwordHash?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  clicks: number;
  expiresAt?: Date | null;
  lastAccessedAt?: Date | null;
  dailyClicks: DailyClick[];
  unfurl?: ShortUrlUnfurl | null;
  createdAt: Date;
  updatedAt: Date;
};

const dailyClickSchema = new Schema<DailyClick>(
  {
    date: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const shortUrlMetaTagSchema = new Schema<ShortUrlMetaTag>(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
  },
  { _id: false },
);

const shortUrlUnfurlSchema = new Schema<ShortUrlUnfurl>(
  {
    title: { type: String, default: null },
    description: { type: String, default: null },
    image: { type: String, default: null },
    imageAlt: { type: String, default: null },
    imageWidth: { type: String, default: null },
    imageHeight: { type: String, default: null },
    siteName: { type: String, default: null },
    type: { type: String, default: null },
    twitterCard: { type: String, default: null },
    video: { type: String, default: null },
    videoSecureUrl: { type: String, default: null },
    videoType: { type: String, default: null },
    appLinks: { type: [shortUrlMetaTagSchema], default: [] },
    finalUrl: { type: String, default: null },
    fetchedAt: { type: Date, default: null },
  },
  { _id: false },
);

const shortUrlSchema = new Schema<ShortUrlAttrs>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    full: { type: String, required: true },
    short: {
      type: String,
      required: true,
      default: () => nanoid(7),
    },
    kind: {
      type: String,
      enum: [...SHORT_URL_KIND_VALUES],
      required: true,
      default: SHORT_URL_KIND.PATH,
    },
    target: {
      type: String,
      enum: ["url", "file"],
      required: true,
      default: "url",
    },
    disposition: {
      type: String,
      enum: ["inline", "attachment"],
      default: null,
    },
    fileName: { type: String, default: null },
    contentType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    fileSource: {
      type: String,
      enum: ["blob", "external"],
      default: null,
    },
    note: { type: String, default: null, maxlength: 500 },
    passwordHash: { type: String, default: null },
    ogTitle: { type: String, default: null },
    ogDescription: { type: String, default: null },
    ogImageUrl: { type: String, default: null },
    clicks: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, default: null },
    lastAccessedAt: { type: Date, default: null },
    dailyClicks: { type: [dailyClickSchema], default: [] },
    unfurl: { type: shortUrlUnfurlSchema, default: null },
  },
  { timestamps: true },
);

// Path and subdomain are separate namespaces (kind+short unique).
// SHORT_URL_KIND.BOTH claims both hosts for one document (app-level collision checks).
shortUrlSchema.index({ kind: 1, short: 1 }, { unique: true });
shortUrlSchema.index({ createdAt: -1 });
shortUrlSchema.index({ userId: 1, createdAt: -1 });

export const ShortUrl =
  (models.ShortUrl as Model<ShortUrlAttrs> | undefined) ??
  model<ShortUrlAttrs>("ShortUrl", shortUrlSchema);

export type ShortUrlDoc = HydratedDocument<ShortUrlAttrs>;
