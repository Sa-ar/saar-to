"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createUrl, updateUrl } from "@/lib/api";
import { toDatetimeLocalValue } from "@/lib/format";
import { upsertUrlInCache } from "@/lib/query";
import type {
  FileDisposition,
  FileSource,
  ShortUrlDto,
  ShortUrlKind,
  ShortUrlTarget,
} from "@/lib/types";
import { SHORT_URL_KIND, hostsToKind, kindHasPath, kindHasSubdomain } from "@/lib/kinds";
import {
  createUrlSchema,
  editUrlSchema,
  formatFormError,
  isReservedSlug,
} from "@/lib/validations/url";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const apexHost =
  typeof window !== "undefined"
    ? (() => {
        try {
          return process.env.NEXT_PUBLIC_BASE_URL
            ? new URL(process.env.NEXT_PUBLIC_BASE_URL).hostname.replace(/^www\./i, "")
            : "saar.to";
        } catch {
          return "saar.to";
        }
      })()
    : "saar.to";

const LINK_ISSUE_PATHS = new Set([
  "fullUrl",
  "slug",
  "kind",
  "target",
  "fileName",
  "contentType",
  "fileSource",
]);

function guessContentType(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "";
}

function fileNameFromUrl(value: string) {
  try {
    const path = new URL(value).pathname;
    const last = path.split("/").filter(Boolean).at(-1);
    return last ? decodeURIComponent(last) : "download";
  } catch {
    return "download";
  }
}

type FormValues = {
  fullUrl: string;
  slug: string;
  expiresAt: string;
  kind: ShortUrlKind;
  target: ShortUrlTarget;
  disposition: FileDisposition;
  fileName: string;
  contentType: string;
  fileSize: number;
  fileSource: FileSource | "";
  note: string;
  password: string;
  removePassword: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
};

type FormPane = "link" | "options";

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; mark?: boolean }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${
              selected
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
            onClick={() => onChange(option.value)}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {option.label}
              {option.mark ? (
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HostToggle({
  id,
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-3">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <p className="break-words text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={cn(
          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={onToggle}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        />
      </button>
    </div>
  );
}

export function UrlForm({
  onSaved,
  isOwner = false,
  url,
  layout = "compact",
}: {
  onSaved?: () => void;
  isOwner?: boolean;
  url?: ShortUrlDto;
  /** page = two-column create layout; compact = edit dialog */
  layout?: "page" | "compact";
}) {
  const isEdit = Boolean(url);
  const queryClient = useQueryClient();
  const schema = isEdit ? editUrlSchema : createUrlSchema;
  const [uploading, setUploading] = useState(false);
  const [pane, setPane] = useState<FormPane>("link");
  const [pasteFileUrl, setPasteFileUrl] = useState(url?.fileSource === "external");

  const mutation = useMutation({
    mutationFn: async (value: FormValues) => {
      const payload = {
        fullUrl: value.fullUrl,
        slug: value.slug,
        expiresAt: value.expiresAt,
        kind: value.kind,
        target: value.target,
        disposition: value.disposition,
        fileName: value.fileName,
        contentType: value.contentType,
        fileSize: value.fileSize || undefined,
        fileSource: value.fileSource || undefined,
        note: value.note,
        password: value.password,
        removePassword: value.removePassword,
        ogTitle: value.ogTitle,
        ogDescription: value.ogDescription,
        ogImageUrl: value.ogImageUrl,
      };
      if (url) {
        return updateUrl(url.id, payload);
      }
      return createUrl(payload);
    },
    onSuccess: (saved) => {
      const description = saved.domainWarning
        ? `${saved.shortUrl} · ${saved.domainWarning}`
        : saved.shortUrl;
      if (isEdit) {
        toast.success("Link updated", { description });
      } else if (saved.target === "file") {
        toast.success("File link created", { description });
      } else if (kindHasSubdomain(saved.kind)) {
        toast.success("Premium link created", { description });
      } else {
        toast.success("Short URL created", { description });
      }
      upsertUrlInCache(queryClient, saved);
      void queryClient.invalidateQueries({ queryKey: ["stats-overview"] });
      onSaved?.();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const form = useForm({
    defaultValues: {
      fullUrl: url?.full ?? "",
      slug: url?.short ?? "",
      expiresAt: url ? toDatetimeLocalValue(url.expiresAt) : "",
      kind: url?.kind ?? SHORT_URL_KIND.PATH,
      target: url?.target ?? ("url" as ShortUrlTarget),
      disposition: url?.disposition ?? ("inline" as FileDisposition),
      fileName: url?.fileName ?? "",
      contentType: url?.contentType ?? "",
      fileSize: url?.fileSize ?? 0,
      fileSource: url?.fileSource ?? ("" as FileSource | ""),
      note: url?.note ?? "",
      password: "",
      removePassword: false as boolean,
      ogTitle: url?.ogTitle ?? "",
      ogDescription: url?.ogDescription ?? "",
      ogImageUrl: url?.ogImageUrl ?? "",
    } satisfies FormValues,
    onSubmit: async ({ value }) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        const hitLink = parsed.error.issues.some((issue) =>
          LINK_ISSUE_PATHS.has(String(issue.path[0] ?? "")),
        );
        setPane(hitLink ? "link" : "options");
        toast.error(parsed.error.issues[0]?.message ?? "Check the form and try again");
        return;
      }
      await mutation.mutateAsync(value);
      if (!isEdit) {
        form.reset();
        setPane("link");
        setPasteFileUrl(false);
      }
    },
  });

  const kind = useStore(form.store, (state) => state.values.kind);
  const slug = useStore(form.store, (state) => state.values.slug);
  const target = useStore(form.store, (state) => state.values.target);
  const fileName = useStore(form.store, (state) => state.values.fileName);
  const hasExtras = useStore(form.store, (state) => {
    const values = state.values;
    return Boolean(
      values.note.trim() ||
      values.password.trim() ||
      values.ogTitle.trim() ||
      values.ogDescription.trim() ||
      values.ogImageUrl.trim() ||
      values.expiresAt.trim() ||
      values.removePassword ||
      url?.hasPassword,
    );
  });
  const pathHost = kindHasPath(kind);
  const subdomainHost = kindHasSubdomain(kind);
  const isFile = target === "file";
  const trimmedSlug = slug.trim();
  const previewSlug = trimmedSlug.toLowerCase() || "your-subdomain";
  const pathPreviewSlug = trimmedSlug || "your-slug";
  const reservedHint =
    trimmedSlug !== "" && isReservedSlug(trimmedSlug)
      ? `This ${subdomainHost ? "vanity label" : "slug"} is reserved`
      : undefined;
  const showHostControls = isOwner;
  const slugRequired = subdomainHost || isEdit;
  const useWideLayout = layout === "page" && !isEdit;

  const setHosts = (nextPath: boolean, nextSubdomain: boolean) => {
    if (!nextPath && !nextSubdomain) {
      toast.error("Pick at least one host");
      return;
    }
    form.setFieldValue("kind", hostsToKind(nextPath, nextSubdomain));
  };

  const applyExternalFileUrl = (value: string) => {
    form.setFieldValue("fullUrl", value);
    form.setFieldValue("fileSource", "external");
    form.setFieldValue("fileName", fileNameFromUrl(value));
    form.setFieldValue("contentType", guessContentType(fileNameFromUrl(value)));
    form.setFieldValue("fileSize", 0);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        multipart: file.size > 4_000_000,
      });
      form.setFieldValue("fullUrl", blob.url);
      form.setFieldValue("fileName", file.name);
      form.setFieldValue("contentType", file.type || guessContentType(file.name));
      form.setFieldValue("fileSize", file.size);
      form.setFieldValue("fileSource", "blob");
      setPasteFileUrl(false);
      toast.success("File uploaded", { description: file.name });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed. Paste an https file URL instead.",
      );
    } finally {
      setUploading(false);
    }
  };

  const submitLabel = uploading
    ? "Uploading…"
    : mutation.isPending
      ? isEdit
        ? "Saving…"
        : "Creating…"
      : isEdit
        ? "Save changes"
        : isFile
          ? "Create file link"
          : subdomainHost
            ? "Create premium link"
            : "Shorten URL";

  const destinationFields = (
    <>
      <form.Field name="target">
        {(field) => (
          <Segmented
            ariaLabel="Destination type"
            value={field.state.value}
            onChange={(value) => {
              field.handleChange(value);
              if (value === "url") {
                form.setFieldValue("fileSource", "");
                form.setFieldValue("fileName", "");
                setPasteFileUrl(false);
              }
            }}
            options={[
              { value: "url", label: "URL" },
              { value: "file", label: "File" },
            ]}
          />
        )}
      </form.Field>

      {isFile ? (
        <>
          <div className="grid min-w-0 gap-2 rounded-xl border border-dashed border-border px-3 py-4">
            <Label htmlFor="file-upload" className="text-sm">
              Upload file
            </Label>
            <Input
              id="file-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              disabled={uploading || mutation.isPending}
              className="h-auto min-w-0 cursor-pointer py-2 file:mr-3"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadFile(file);
                }
              }}
            />
            <p className="break-words text-xs text-muted-foreground">
              {fileName ? `Selected · ${fileName}` : "PDF, images, zip, or Office · 15 MB max."}
            </p>
            {pasteFileUrl ? null : (
              <button
                type="button"
                className="justify-self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => setPasteFileUrl(true)}
              >
                Paste a file URL instead
              </button>
            )}
          </div>

          {pasteFileUrl ? (
            <form.Field name="fullUrl">
              {(field) => (
                <FormField
                  label="File URL"
                  htmlFor={field.name}
                  requirement="Required"
                  hint="https://example.com/resume.pdf"
                  error={
                    field.state.meta.errors[0]
                      ? formatFormError(field.state.meta.errors[0])
                      : undefined
                  }
                >
                  <Input
                    id={field.name}
                    name={field.name}
                    type="url"
                    placeholder="https://example.com/resume.pdf"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      applyExternalFileUrl(event.target.value);
                    }}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                </FormField>
              )}
            </form.Field>
          ) : null}

          <form.Field name="disposition">
            {(field) => (
              <Segmented
                ariaLabel="File disposition"
                value={field.state.value}
                onChange={field.handleChange}
                options={[
                  { value: "inline", label: "Open in browser" },
                  { value: "attachment", label: "Force download" },
                ]}
              />
            )}
          </form.Field>
          <p className="text-xs text-muted-foreground">
            Choose whether visitors open the file or download it
          </p>
        </>
      ) : (
        <form.Field name="fullUrl">
          {(field) => (
            <FormField
              label="Destination URL"
              htmlFor={field.name}
              requirement="Required"
              hint="https://example.com/very/long/path"
              error={
                field.state.meta.errors[0] ? formatFormError(field.state.meta.errors[0]) : undefined
              }
            >
              <Input
                id={field.name}
                name={field.name}
                type="url"
                placeholder="https://example.com/very/long/path"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
              />
            </FormField>
          )}
        </form.Field>
      )}
    </>
  );

  const hostAndSlugFields = (
    <>
      {showHostControls ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium">Hosts</p>
          <HostToggle
            id="host-path"
            label={`Path · ${apexHost}/${pathPreviewSlug}`}
            description="Serve on the apex path"
            checked={pathHost}
            onToggle={() => setHosts(!pathHost, subdomainHost)}
          />
          <HostToggle
            id="host-subdomain"
            label={`Subdomain · ${previewSlug}.${apexHost}`}
            description="Owner only · vanity DNS label"
            checked={subdomainHost}
            onToggle={() => setHosts(pathHost, !subdomainHost)}
          />
        </div>
      ) : null}

      <form.Field name="slug">
        {(field) => (
          <FormField
            label={subdomainHost && !pathHost ? "Subdomain" : "Custom slug"}
            htmlFor={field.name}
            requirement={slugRequired ? "Required" : "Optional"}
            hint={
              subdomainHost && pathHost
                ? `${apexHost}/${pathPreviewSlug} and ${previewSlug}.${apexHost}`
                : subdomainHost
                  ? `https://${previewSlug}.${apexHost}`
                  : isEdit
                    ? `${apexHost}/${pathPreviewSlug}`
                    : `Optional · ${apexHost}/${pathPreviewSlug}`
            }
            error={
              field.state.meta.errors[0]
                ? formatFormError(field.state.meta.errors[0])
                : reservedHint
            }
          >
            <Input
              id={field.name}
              name={field.name}
              placeholder={subdomainHost ? "resume" : "my-link"}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={field.state.meta.errors.length > 0 || Boolean(reservedHint)}
            />
          </FormField>
        )}
      </form.Field>
    </>
  );

  const optionsFields = (
    <>
      <div className="space-y-1 font-mono text-xs text-muted-foreground">
        {pathHost ? <p className="break-all">{`${apexHost}/${pathPreviewSlug}`}</p> : null}
        {subdomainHost ? <p className="break-all">{`${previewSlug}.${apexHost}`}</p> : null}
      </div>

      <form.Field name="note">
        {(field) => (
          <FormField
            label="Internal note"
            htmlFor={field.name}
            requirement="Optional"
            hint="Only visible in the dashboard"
            error={
              field.state.meta.errors[0] ? formatFormError(field.state.meta.errors[0]) : undefined
            }
          >
            <Input
              id={field.name}
              name={field.name}
              placeholder="Why this link exists"
              maxLength={500}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="expiresAt">
        {(field) => (
          <FormField
            label="Expires"
            htmlFor={field.name}
            requirement="Optional"
            error={
              field.state.meta.errors[0] ? formatFormError(field.state.meta.errors[0]) : undefined
            }
          >
            <Input
              id={field.name}
              name={field.name}
              type="datetime-local"
              className="min-w-0"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <FormField
            label="Password"
            htmlFor={field.name}
            requirement="Optional"
            hint={
              url?.hasPassword
                ? "Leave blank to keep the current password"
                : "Visitors must enter this to open the link"
            }
          >
            <Input
              id={field.name}
              name={field.name}
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </FormField>
        )}
      </form.Field>

      {url?.hasPassword ? (
        <form.Field name="removePassword">
          {(field) => (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(event) => field.handleChange(event.target.checked)}
              />
              Remove password
            </label>
          )}
        </form.Field>
      ) : null}

      <div className="grid min-w-0 gap-3 rounded-xl border border-border/80 px-3 py-3">
        <div className="space-y-1">
          <p className="text-sm">Link preview</p>
          <p className="text-xs text-muted-foreground">
            Optional title, description, and image for Slack / iMessage
          </p>
        </div>
        <form.Field name="ogTitle">
          {(field) => (
            <Input
              id={field.name}
              name={field.name}
              placeholder="OG title"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
        <form.Field name="ogDescription">
          {(field) => (
            <Input
              id={field.name}
              name={field.name}
              placeholder="OG description"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
        <form.Field name="ogImageUrl">
          {(field) => (
            <Input
              id={field.name}
              name={field.name}
              type="url"
              placeholder="https://example.com/card.png"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
      </div>
    </>
  );

  return (
    <form
      className="grid min-w-0 gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Segmented
        ariaLabel="Form section"
        value={pane}
        onChange={setPane}
        options={[
          { value: "link", label: "Link" },
          { value: "options", label: "Options", mark: hasExtras },
        ]}
      />

      {pane === "link" ? (
        useWideLayout ? (
          <div className="grid min-w-0 gap-6 md:grid-cols-2">
            <div className="grid min-w-0 content-start gap-4">{destinationFields}</div>
            <div className="grid min-w-0 content-start gap-4">{hostAndSlugFields}</div>
          </div>
        ) : (
          <div className="grid min-w-0 gap-4">
            {destinationFields}
            {hostAndSlugFields}
          </div>
        )
      ) : (
        <div className={cn("grid min-w-0 gap-4", useWideLayout && "md:max-w-xl")}>
          {optionsFields}
        </div>
      )}

      <Button
        type="submit"
        className={cn(
          "h-10 rounded-full shadow-[0_0_24px_rgb(249_208_38/0.25)]",
          useWideLayout ? "md:w-auto md:justify-self-start md:px-8" : "w-full",
        )}
        disabled={mutation.isPending || uploading}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
