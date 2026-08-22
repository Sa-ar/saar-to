import type { StatsOverviewDto } from "@/lib/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function UrlOverview({
  overview,
  isPending = false,
}: {
  overview?: StatsOverviewDto;
  isPending?: boolean;
}) {
  if (isPending || !overview) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} size="sm">
            <CardHeader className="gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-8 w-12" />
            </CardHeader>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label="Links" value={overview.links} />
      <StatCard label="Clicks" value={overview.clicks} />
      <StatCard label="Unique visitors" value={overview.uniqueVisitors} />
      <StatCard label="Active" value={overview.active} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm" className="transition-shadow hover:ring-primary/25">
      <CardHeader>
        <CardDescription className="font-mono text-[11px] uppercase tracking-[0.18em]">
          {label}
        </CardDescription>
        <CardTitle className="font-heading text-3xl tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}
