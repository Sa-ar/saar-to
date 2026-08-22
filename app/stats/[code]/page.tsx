import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { UrlStats } from "@/components/url-stats";
import { getSession } from "@/lib/auth";
import { urlQueryKey } from "@/lib/query";
import { makeQueryClient } from "@/lib/query-client";
import { loadUrl } from "@/lib/url-data";
import { getBaseUrl } from "@/lib/urls";

export default async function StatsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getSession();
  const queryClient = makeQueryClient();

  if (session?.user?.id) {
    const url = await loadUrl(code, session.user.id, session.user.role, getBaseUrl());
    if (url) {
      queryClient.setQueryData(urlQueryKey(url.id), url);
      queryClient.setQueryData(urlQueryKey(code), url);
    }
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UrlStats code={code} />
    </HydrationBoundary>
  );
}
