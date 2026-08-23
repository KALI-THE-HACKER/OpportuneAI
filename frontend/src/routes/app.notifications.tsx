import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · OpportuneAI" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = q.data?.filter((n) => !n.read).length ?? 0;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Activity updates, match alerts, and pipeline events."
        actions={
          unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border bg-card rounded-lg shadow-card hover:shadow-elevated transition-all duration-150"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read
            </button>
          )
        }
      />

      {q.isLoading ? (
        <LoadingState variant="spinner" label="Loading notifications…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" />}
          title="You're all caught up!"
          description="New match alerts, pipeline events, and system messages will appear here."
        />
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden divide-y divide-border">
          {q.data!.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 px-5 py-4 transition-colors duration-100 ${
                n.read ? "" : "bg-accent/4 dark:bg-accent/6"
              }`}
            >
              <div
                className={`size-2 rounded-full mt-2 shrink-0 transition-opacity ${n.read ? "opacity-0" : "bg-accent"}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className={`text-sm ${n.read ? "text-muted-foreground" : "font-semibold text-foreground"}`}
                  >
                    {n.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                )}
              </div>
              {!n.read && (
                <button
                  onClick={() => markOne.mutate(n.id)}
                  className="shrink-0 size-7 grid place-items-center rounded-lg border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-card shadow-sm transition-all duration-150 cursor-pointer"
                  title="Mark as read"
                >
                  <Check className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
