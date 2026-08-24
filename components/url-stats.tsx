"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUrl, fetchUrlClicks, isApiError } from "@/lib/api";
import { HTTP_STATUS } from "@/lib/http";
import { formatDate } from "@/lib/format";
import { urlQueryKey } from "@/lib/query";
import { BreakdownList, ClicksChart } from "@/components/clicks-chart";
import { HideBotsToggle } from "@/components/hide-bots-toggle";
import { PageShell } from "@/components/page-shell";
import { QrDialog } from "@/components/qr-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SHORT_URL_KIND, kindHasSubdomain } from "@/lib/kinds";

export function UrlStats({ code }: { code: string }) {
  const [hideBots, setHideBots] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const query = useQuery({
    queryKey: urlQueryKey(code),
    queryFn: () => fetchUrl(code),
  });
  const clicksQuery = useQuery({
    queryKey: ["url-clicks", code, hideBots],
    queryFn: () => fetchUrlClicks(code, hideBots),
    enabled: query.isSuccess,
  });

  if (query.isPending) {
    return (
      <PageShell className="gap-6">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <LoadingState label="Loading stats…" className="py-8" />
      </PageShell>
    );
  }

  if (query.isError) {
    const notFound = isApiError(query.error) && query.error.status === HTTP_STATUS.NOT_FOUND;

    if (notFound) {
      return (
        <PageShell className="items-center justify-center gap-4 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">saar.to</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Link not found</h1>
          <p className="text-muted-foreground">
            This short URL does not exist or could not be loaded.
          </p>
          <Button className="rounded-full" render={<Link href="/" />}>
            Back to home
          </Button>
        </PageShell>
      );
    }

    return (
      <PageShell className="items-center justify-center">
        <ErrorState
          title="Could not load stats"
          message={query.error instanceof Error ? query.error.message : "Request failed"}
          onRetry={() => {
            void query.refetch();
          }}
          action={
            <Button variant="outline" className="rounded-full" render={<Link href="/" />}>
              Back to home
            </Button>
          }
        />
      </PageShell>
    );
  }

  const url = query.data;
  const clicks = clicksQuery.data;

  return (
    <PageShell className="gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">saar.to</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {url.kind === SHORT_URL_KIND.PATH
              ? url.short
              : url.shortUrl.replace(/^https?:\/\//, "")}
          </h1>
          {url.kind === SHORT_URL_KIND.BOTH && url.pathUrl ? (
            <a
              href={url.pathUrl}
              className="block max-w-2xl truncate font-mono text-sm text-muted-foreground underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {url.pathUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
          <a
            href={url.full}
            className="block max-w-2xl truncate text-sm text-primary underline-offset-4 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            {url.full}
          </a>
          <div className="flex flex-wrap gap-2">
            {url.expired ? (
              <Badge variant="destructive">Expired</Badge>
            ) : (
              <Badge variant="outline">Active</Badge>
            )}
            {kindHasSubdomain(url.kind) ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                {url.kind === SHORT_URL_KIND.BOTH ? "Path + Premium" : "Premium"}
              </Badge>
            ) : null}
            {url.hasPassword ? <Badge variant="outline">Password</Badge> : null}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:w-72">
          <HideBotsToggle checked={hideBots} onCheckedChange={setHideBots} />
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setQrOpen(true)}
          >
            QR code
          </Button>
          <Button variant="outline" className="rounded-full" render={<Link href="/" />}>
            Back to dashboard
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clicks" value={String(clicks?.clicks ?? url.clicks)} />
        <Stat
          label="Unique visitors"
          value={clicksQuery.isPending ? "…" : String(clicks?.uniqueVisitors ?? 0)}
        />
        <Stat label="Created" value={formatDate(url.createdAt)} />
        <Stat label="Last access" value={formatDate(url.lastAccessedAt)} />
      </div>
      <p className="text-sm text-muted-foreground">
        Expires {url.expiresAt ? formatDate(url.expiresAt) : "never"}
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Last 14 days</CardTitle>
          <CardDescription>UTC daily visits</CardDescription>
        </CardHeader>
        <CardContent>
          {clicksQuery.isPending ? (
            <LoadingState label="Loading chart…" className="py-8" />
          ) : clicksQuery.isError ? (
            <ErrorState
              title="Could not load click history"
              message={clicksQuery.error instanceof Error ? clicksQuery.error.message : undefined}
              onRetry={() => {
                void clicksQuery.refetch();
              }}
            />
          ) : clicks && clicks.daily.every((day) => day.count === 0) ? (
            <EmptyState
              title="No visits in this window"
              description="Share the short URL to start collecting clicks."
            />
          ) : clicks ? (
            <ClicksChart daily={clicks.daily} />
          ) : null}
        </CardContent>
      </Card>

      {clicks ? (
        <div className="grid gap-3 md:grid-cols-2">
          <BreakdownList title="Country" rows={clicks.breakdowns.country} />
          <BreakdownList title="Referrer" rows={clicks.breakdowns.referrer} />
          <BreakdownList title="Device" rows={clicks.breakdowns.device} />
          <BreakdownList title="Browser" rows={clicks.breakdowns.browser} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent hits</CardTitle>
          <CardDescription>Newest 50 recorded visits</CardDescription>
        </CardHeader>
        <CardContent>
          {clicksQuery.isPending ? (
            <LoadingState label="Loading hits…" className="py-8" />
          ) : !clicks || clicks.recent.length === 0 ? (
            <EmptyState title="No hits yet" description="Visits will show up here." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Bot</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clicks.recent.map((hit) => (
                  <TableRow key={hit.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(hit.createdAt)}</TableCell>
                    <TableCell>
                      {[hit.city, hit.country].filter(Boolean).join(", ") || "(unknown)"}
                    </TableCell>
                    <TableCell>{hit.deviceType || "—"}</TableCell>
                    <TableCell>
                      {[hit.browser, hit.browserVersion].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell className="max-w-[10rem] truncate">{hit.referrerHost}</TableCell>
                    <TableCell className="font-mono text-xs">{hit.ip || "—"}</TableCell>
                    <TableCell>{hit.isBot ? <Badge variant="outline">Bot</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <QrDialog
        url={qrOpen ? url.shortUrl : null}
        shortUrl={url.shortUrl}
        onOpenChange={setQrOpen}
      />
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
