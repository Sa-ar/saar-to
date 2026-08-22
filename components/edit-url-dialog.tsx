"use client";

import type { ShortUrlDto } from "@/lib/types";
import { UrlForm } from "@/components/url-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EditUrlDialog({
  url,
  onOpenChange,
  isOwner = false,
}: {
  /** The link being edited, or null when the dialog is closed. */
  url: ShortUrlDto | null;
  onOpenChange: (open: boolean) => void;
  isOwner?: boolean;
}) {
  return (
    <Dialog open={url !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit link</DialogTitle>
          <DialogDescription>
            Change the destination on Link. Password, expiry, and preview live under Options.
          </DialogDescription>
        </DialogHeader>
        {url ? (
          <UrlForm
            key={url.id}
            url={url}
            isOwner={isOwner}
            onSaved={() => {
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
