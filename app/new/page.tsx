import { CreateLinkPage } from "@/components/create-link-page";
import { getSession } from "@/lib/auth";
import { USER_ROLE } from "@/lib/user-role";

export default async function NewLinkRoute() {
  const session = await getSession();
  const isOwner = session?.user?.role === USER_ROLE.OWNER;

  return <CreateLinkPage isOwner={isOwner} />;
}
