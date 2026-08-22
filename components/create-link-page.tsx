"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UrlForm } from "@/components/url-form";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { FORM_LAYOUT } from "@/lib/link-enums";

export function CreateLinkPage({ isOwner = false }: { isOwner?: boolean }) {
  const router = useRouter();

  return (
    <PageShell className="gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">saar.to</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight">Create a link</h1>
          <p className="max-w-xl text-muted-foreground">
            {isOwner
              ? "Paste a URL or attach a file. Choose path and/or subdomain hosts. Extras live under Options."
              : "Paste a URL or attach a file. Password, note, and preview live under Options."}
          </p>
        </div>
        <Button variant="outline" className="rounded-full" render={<Link href="/" />}>
          Back to dashboard
        </Button>
      </div>

      <UrlForm
        layout={FORM_LAYOUT.PAGE}
        isOwner={isOwner}
        onSaved={() => {
          router.push("/");
        }}
      />
    </PageShell>
  );
}
