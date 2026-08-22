import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Providers } from "@/app/providers";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const sans = Space_Grotesk({
  variable: "--font-space",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "saar.to",
  description: "Personal URL shortener — create, track, and share links.",
  metadataBase: new URL("https://saar.to"),
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${sans.variable} ${mono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
