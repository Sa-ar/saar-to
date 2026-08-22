import Link from "next/link";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { PAGE_CONTAINER_CLASS } from "@/components/page-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

export async function SiteHeader() {
  const session = await getSession();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/70 backdrop-blur-md">
      <div className={cn(PAGE_CONTAINER_CLASS, "flex h-16 items-center justify-between gap-4")}>
        <Link
          href={session ? "/" : "/login"}
          className="flex items-center gap-2.5 font-heading text-lg tracking-tight"
        >
          <span className="size-2 rounded-full bg-primary shadow-[0_0_14px_var(--primary)]" />
          saar<span className="text-primary">.to</span>
        </Link>
        {session?.user ? (
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[16rem] truncate font-mono text-xs text-muted-foreground sm:inline">
              {session.user.name ?? session.user.email}
            </span>
            <SignOutButton />
          </div>
        ) : (
          <Button className="rounded-full" render={<Link href="/login" />}>
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
