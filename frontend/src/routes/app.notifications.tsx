import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  Send,
  Bookmark,
  Sparkles,
  Zap,
  Info,
} from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications · OpportuneAI" }] }),
  component: NotificationsPage,
});

function getActivityMeta(type: string) {
  switch (type) {
    case "application":
      return {
        icon: Send,
        badgeClass:
          "bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      };
    case "save":
    case "bookmark":
      return {
        icon: Bookmark,
        badgeClass:
          "bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
      };
    case "resume":
      return {
        icon: Sparkles,
        badgeClass:
          "bg-violet-500/10 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20",
      };
    case "match":
      return {
        icon: Zap,
        badgeClass:
          "bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
      };
    default:
      return {
        icon: Info,
        badgeClass: "bg-accent/10 text-accent border-accent/20",
      };
  }
}

function NotificationsPage() {
  const qc = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<"all" | "unread">("all");
  const q = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const allItems = q.data ?? [];
  const unreadCount = allItems.filter((n) => !n.read).length;
  const filteredItems = activeFilter === "unread" ? allItems.filter((n) => !n.read) : allItems;

  return (
    <>
      <PageHeader
        title="Notifications & Activity"
        description="Real-time activity log, match updates, and pipeline events."
        actions={
          unreadCount > 0 && (
            <button
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="h-8 px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border bg-card rounded-lg shadow-card hover:shadow-elevated transition-all duration-150 cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              Mark all as read ({unreadCount})
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeFilter === "all"
              ? "bg-foreground text-background shadow-card"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          All ({allItems.length})
        </button>
        <button
          onClick={() => setActiveFilter("unread")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeFilter === "unread"
              ? "bg-foreground text-background shadow-card"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </button>
      </div>

      {q.isLoading ? (
        <LoadingState variant="spinner" label="Loading notifications…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-6" />}
          title={activeFilter === "unread" ? "No unread notifications" : "You're all caught up!"}
          description={
            activeFilter === "unread"
              ? "All recent activities and alerts have been marked as read."
              : "New match alerts, pipeline events, and job interactions will appear here."
          }
        />
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden divide-y divide-border">
          {filteredItems.map((n) => {
            const meta = getActivityMeta(n.type);
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`flex items-start gap-4 px-5 py-4 transition-colors duration-100 ${
                  n.read ? "hover:bg-surface/50" : "bg-accent/4 dark:bg-accent/6 hover:bg-accent/8"
                }`}
              >
                <div
                  className={`size-9 rounded-xl grid place-items-center shrink-0 border ${meta.badgeClass}`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${n.read ? "text-muted-foreground" : "font-semibold text-foreground"}`}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span className="size-2 rounded-full bg-accent shrink-0" />
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {n.body}
                    </p>
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
            );
          })}
        </div>
      )}
    </>
  );
}
