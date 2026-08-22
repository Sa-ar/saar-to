import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Dashboard } from "@/components/dashboard";
import { getSession } from "@/lib/auth";
import { seedUrlCaches, urlsQueryKey } from "@/lib/query";
import { makeQueryClient } from "@/lib/query-client";
import { loadUrlList } from "@/lib/url-data";
import { getBaseUrl } from "@/lib/urls";
import { USER_ROLE } from "@/lib/user-role";

export default async function Home() {
  const session = await getSession();
  const isOwner = session?.user?.role === USER_ROLE.OWNER;
  const queryClient = makeQueryClient();

  if (session?.user?.id) {
    const urls = await loadUrlList(session.user.id, session.user.role, getBaseUrl());
    queryClient.setQueryData(urlsQueryKey, urls);
    seedUrlCaches(queryClient, urls);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard isOwner={isOwner} />
    </HydrationBoundary>
  );
}
