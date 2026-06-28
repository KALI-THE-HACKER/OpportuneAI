import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Sparkles, Briefcase, Settings as Cog } from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";
import type { NotificationItem } from "@/lib/mock/user";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · OpportuneAI" }] }),
  component: NotificationsPage,
});

const ICONS: Record<NotificationItem["type"], React.ComponentType<{ className?: string }>> = {
  match: Sparkles,
  application: Briefcase,
  interview: Briefcase,
  system: Cog,
};

function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Matches, application updates, and system events."
        actions={
          <button
            onClick={() => markAll.mutate()}
            className="h-8 px-3 rounded-md ring-1 ring-border text-sm hover:bg-surface"
          >
            Mark all read
          </button>
        }
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="You're all caught up"
          description="New matches and updates will land here."
        />
      ) : (
        <div className="bg-card ring-1 ring-border rounded-lg divide-y divide-border">
          {q.data!.map((n) => {
            const Icon = ICONS[n.type];
            return (
              <div
                key={n.id}
                className={`p-4 flex items-start gap-4 ${n.read ? "" : "bg-accent/[0.03]"}`}
              >
                <div
                  className={`size-9 shrink-0 grid place-items-center rounded-md ${n.read ? "bg-surface text-muted-foreground" : "bg-accent/10 text-accent"}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{n.title}</h3>
                    {!n.read && <span className="size-1.5 rounded-full bg-accent shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markRead.mutate(n.id)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Mark read
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
