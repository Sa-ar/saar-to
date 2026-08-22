"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { formatDay } from "@/lib/format";
import type { BreakdownRow, DailyClick } from "@/lib/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const chartConfig = {
  count: {
    label: "Clicks",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function ClicksChart({ daily }: { daily: DailyClick[] }) {
  const data = daily.map((entry) => ({
    ...entry,
    label: formatDay(entry.date),
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function BreakdownList({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>From recorded visits</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <ul className="grid gap-2">
            {rows.slice(0, 8).map((row) => (
              <li key={row.label} className="grid gap-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">{row.count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
