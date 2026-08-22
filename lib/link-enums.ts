export const SHORT_URL_TARGET = {
  URL: "url",
  FILE: "file",
} as const;

export type ShortUrlTarget = (typeof SHORT_URL_TARGET)[keyof typeof SHORT_URL_TARGET];

export const SHORT_URL_TARGET_VALUES = [SHORT_URL_TARGET.URL, SHORT_URL_TARGET.FILE] as const;

export const FILE_DISPOSITION = {
  INLINE: "inline",
  ATTACHMENT: "attachment",
} as const;

export type FileDisposition = (typeof FILE_DISPOSITION)[keyof typeof FILE_DISPOSITION];

export const FILE_DISPOSITION_VALUES = [
  FILE_DISPOSITION.INLINE,
  FILE_DISPOSITION.ATTACHMENT,
] as const;

export const FILE_SOURCE = {
  BLOB: "blob",
  EXTERNAL: "external",
} as const;

export type FileSource = (typeof FILE_SOURCE)[keyof typeof FILE_SOURCE];

export const FILE_SOURCE_VALUES = [FILE_SOURCE.BLOB, FILE_SOURCE.EXTERNAL] as const;

export const LINK_STATUS_FILTER = {
  ALL: "all",
  ACTIVE: "active",
  EXPIRED: "expired",
} as const;

export type LinkStatusFilter = (typeof LINK_STATUS_FILTER)[keyof typeof LINK_STATUS_FILTER];

export const LINK_STATUS_FILTER_VALUES = [
  LINK_STATUS_FILTER.ALL,
  LINK_STATUS_FILTER.ACTIVE,
  LINK_STATUS_FILTER.EXPIRED,
] as const;

export const NODE_ENV = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
} as const;

export const CLI_TARGET = {
  LOCAL: "local",
  PRODUCTION: "production",
} as const;

export type CliTarget = (typeof CLI_TARGET)[keyof typeof CLI_TARGET];

export const FORM_PANE = {
  LINK: "link",
  OPTIONS: "options",
} as const;

export type FormPane = (typeof FORM_PANE)[keyof typeof FORM_PANE];

export const FORM_LAYOUT = {
  PAGE: "page",
  DIALOG: "dialog",
} as const;

export type FormLayout = (typeof FORM_LAYOUT)[keyof typeof FORM_LAYOUT];

export const TABLE_SORT = {
  ASC: "asc",
  DESC: "desc",
} as const;

export const AUTH_ERROR = {
  INVITE: "invite",
} as const;

export const DEVICE_PLATFORM = {
  ANDROID: "android",
  IOS: "ios",
} as const;

export type DevicePlatform = (typeof DEVICE_PLATFORM)[keyof typeof DEVICE_PLATFORM];

export const HOST_LABEL = {
  WWW: "www",
  LOCALHOST: "localhost",
} as const;

export const QUERY_FLAG = {
  TRUE: "true",
} as const;

export const URL_FORM_FIELD = {
  FULL_URL: "fullUrl",
  SLUG: "slug",
  KIND: "kind",
  TARGET: "target",
  FILE_NAME: "fileName",
  CONTENT_TYPE: "contentType",
  FILE_SOURCE: "fileSource",
} as const;
