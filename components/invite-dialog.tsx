"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createInvite, fetchInvites, revokeInvite, type InviteDto } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { EmptyState, ErrorState, LoadingState } from "@/components/query-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Invite link copied");
  } catch {
    toast.error("Could not copy invite link");
  }
}

export function InviteDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const invitesQuery = useQuery({
    queryKey: ["invites"],
    queryFn: fetchInvites,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: createInvite,
    onSuccess: async (invite) => {
      await copyText(invite.url);
      void queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeInvite,
    onSuccess: () => {
      toast.success("Invite revoked");
      void queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" className="rounded-full" />}>
        <UserPlus data-icon="inline-start" />
        Invite
      </DialogTrigger>
      <DialogContent className="min-w-0 overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite someone</DialogTitle>
          <DialogDescription>
            One-time links expire in 7 days. Recipients register as members and only see their own
            links.
          </DialogDescription>
        </DialogHeader>

        <Button
          type="button"
          className="rounded-full"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Creating…" : "Create invite and copy link"}
        </Button>

        <div className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Pending
          </p>
          {invitesQuery.isPending ? (
            <LoadingState label="Loading invites…" className="py-8" />
          ) : invitesQuery.isError ? (
            <ErrorState
              className="py-8"
              title="Could not load invites"
              message={invitesQuery.error instanceof Error ? invitesQuery.error.message : undefined}
              onRetry={() => {
                void invitesQuery.refetch();
              }}
            />
          ) : (invitesQuery.data?.length ?? 0) === 0 ? (
            <EmptyState
              className="py-8"
              title="No open invites"
              description="Create a link to invite someone."
            />
          ) : (
            <ul className="space-y-2">
              {(invitesQuery.data as InviteDto[]).map((invite) => (
                <li
                  key={invite.id}
                  className="flex min-w-0 items-start justify-between gap-2 overflow-hidden rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0 flex-1 space-y-1 overflow-hidden">
                    <p className="break-all font-mono text-xs">{invite.url}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Copy invite"
                      onClick={() => {
                        void copyText(invite.url);
                      }}
                    >
                      <Copy />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Revoke invite"
                      disabled={revokeMutation.isPending && revokeMutation.variables === invite.id}
                      onClick={() => revokeMutation.mutate(invite.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
