"use client";

import { dehydrate, hydrate, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { LIMITS } from "@/lib/limits";
import { QUERY_PERSIST_KEY } from "@/lib/query";
import { makeQueryClient } from "@/lib/query-client";

let browserQueryClient: ReturnType<typeof makeQueryClient> | undefined;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

function persist(client: ReturnType<typeof makeQueryClient>) {
  try {
    sessionStorage.setItem(QUERY_PERSIST_KEY, JSON.stringify(dehydrate(client)));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }

  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
    try {
      const raw = sessionStorage.getItem(QUERY_PERSIST_KEY);
      if (raw) {
        hydrate(browserQueryClient, JSON.parse(raw) as Parameters<typeof hydrate>[1]);
      }
    } catch {
      sessionStorage.removeItem(QUERY_PERSIST_KEY);
    }

    browserQueryClient.getQueryCache().subscribe(() => {
      if (persistTimer) {
        clearTimeout(persistTimer);
      }
      persistTimer = setTimeout(() => {
        if (browserQueryClient) {
          persist(browserQueryClient);
        }
      }, LIMITS.QUERY_PERSIST_DEBOUNCE_MS);
    });
  }

  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
