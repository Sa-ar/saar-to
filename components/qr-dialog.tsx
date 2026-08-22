"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function qrFileName(shortUrl: string) {
  try {
    const parsed = new URL(shortUrl);
    const host = parsed.hostname.replace(/^www\./i, "");
    const label =
      host.endsWith(".saar.to") && host !== "saar.to"
        ? host.slice(0, -".saar.to".length)
        : parsed.pathname.replace(/^\//, "") || "link";
    return `saar-to-${label}.png`;
  } catch {
    return "saar-to-qr.png";
  }
}

function canvasPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not export QR image"));
      }
    }, "image/png");
  });
}

export function QrDialog({
  url,
  shortUrl,
  onOpenChange,
}: {
  url: string | null;
  shortUrl: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const qrCanvas = () => canvasWrapRef.current?.querySelector("canvas") ?? null;

  const copyPng = async () => {
    const canvas = qrCanvas();
    if (!canvas) {
      return;
    }

    try {
      const blob = await canvasPngBlob(canvas);
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      } catch {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": Promise.resolve(blob) }),
        ]);
      }
      toast.success("QR image copied");
    } catch {
      toast.error("Could not copy the QR image");
    }
  };

  const downloadPng = async () => {
    const canvas = qrCanvas();
    if (!canvas || !shortUrl) {
      return;
    }

    try {
      const blob = await canvasPngBlob(canvas);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = qrFileName(shortUrl);
      link.click();
      URL.revokeObjectURL(href);
    } catch {
      toast.error("Could not download the QR image");
    }
  };

  return (
    <Dialog open={url !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">{shortUrl}</DialogDescription>
        </DialogHeader>
        {url ? (
          <div className="grid gap-4">
            <div
              ref={canvasWrapRef}
              className="flex justify-center rounded-xl bg-background p-2 ring-1 ring-border"
            >
              <QRCodeCanvas
                value={url}
                size={320}
                bgColor="#0a0512"
                fgColor="#F9D026"
                marginSize={2}
                title={`QR code for ${shortUrl}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  void copyPng();
                }}
              >
                Copy image
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => {
                  void downloadPng();
                }}
              >
                Download
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
