import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared content width so the header and every page line up. */
export const PAGE_CONTAINER_CLASS = "mx-auto w-full max-w-5xl px-4";

export function PageShell({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      className={cn(PAGE_CONTAINER_CLASS, "flex flex-1 flex-col py-10", className)}
      {...props}
    />
  );
}
