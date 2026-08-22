"use client";

import { Label } from "@/components/ui/label";

export function HideBotsToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-3">
      <div className="space-y-1">
        <Label htmlFor="hide-bots-toggle" className="text-sm">
          Hide bots
        </Label>
        <p className="text-xs text-muted-foreground">
          {checked ? "Clicks and uniques exclude crawlers" : "Showing all visits, including bots"}
        </p>
      </div>
      <button
        id="hide-bots-toggle"
        type="button"
        role="switch"
        aria-checked={checked}
        className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted-foreground/30"
        }`}
        onClick={() => {
          onCheckedChange(!checked);
        }}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-background transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
