import assert from "node:assert/strict";
import { test } from "node:test";
import { SHORT_URL_KIND } from "../kinds";
import { FILE_SOURCE, SHORT_URL_TARGET } from "../link-enums";
import { LIMITS } from "../limits";
import { createUrlSchema } from "./url";

function urlCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    fullUrl: "https://example.com/destination",
    slug: "docs",
    expiresAt: "",
    kind: SHORT_URL_KIND.PATH,
    target: SHORT_URL_TARGET.URL,
    fileSource: "",
    ...overrides,
  };
}

void test("URL-mode create accepts empty fileSource sentinel", () => {
  const parsed = createUrlSchema.safeParse(urlCreateInput());
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.target, SHORT_URL_TARGET.URL);
    assert.equal(parsed.data.fileSource, undefined);
  }
});

void test("path slug wa (2 chars) passes validation", () => {
  assert.equal(LIMITS.SLUG_MIN, 2);
  const parsed = createUrlSchema.safeParse(urlCreateInput({ slug: "wa" }));
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.slug, "wa");
  }
});

void test("path slug of 1 character is still rejected", () => {
  const parsed = createUrlSchema.safeParse(urlCreateInput({ slug: "w" }));
  assert.equal(parsed.success, false);
});

void test("reserved slugs stay reserved after lowering SLUG_MIN", () => {
  const parsed = createUrlSchema.safeParse(urlCreateInput({ slug: "go" }));
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.match(parsed.error.issues[0]?.message ?? "", /reserved/i);
  }
});

void test("file-mode create still requires a fileSource", () => {
  const parsed = createUrlSchema.safeParse(
    urlCreateInput({
      target: SHORT_URL_TARGET.FILE,
      fullUrl: "",
      fileSource: "",
    }),
  );
  assert.equal(parsed.success, false);
});

void test("file-mode create accepts blob fileSource", () => {
  const parsed = createUrlSchema.safeParse(
    urlCreateInput({
      target: SHORT_URL_TARGET.FILE,
      fullUrl: "https://files.example.com/resume.pdf",
      fileSource: FILE_SOURCE.BLOB,
      fileName: "resume.pdf",
      contentType: "application/pdf",
    }),
  );
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.fileSource, FILE_SOURCE.BLOB);
  }
});

void test("subdomain slug still rejects underscores", () => {
  const parsed = createUrlSchema.safeParse(
    urlCreateInput({
      kind: SHORT_URL_KIND.SUBDOMAIN,
      slug: "w_a",
    }),
  );
  assert.equal(parsed.success, false);
});
