import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageShell } from "@/components/page-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <PageShell className="items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-10 w-full rounded-full" />
        </CardContent>
      </Card>
    </PageShell>
  );
}
