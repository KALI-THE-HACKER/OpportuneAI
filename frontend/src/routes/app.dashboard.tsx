import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Activity,
  Briefcase,
  Send,
  Sparkles,
  Loader2,
  CheckCircle2,
  Zap,
  Bookmark,
  Bell,
  Inbox,
} from "lucide-react";
import { jobsApi, adminApi, notificationsApi, resumeApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { JobCard } from "@/components/shared/job-card";
import { LoadingState, ErrorState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · OpportuneAI" }] }),
  component: DashboardPage,
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
        icon: Bell,
        badgeClass: "bg-accent/10 text-accent border-accent/20",
      };
  }
}

function DashboardPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const recs = useQuery({
    queryKey: ["feed", { limit: 4 }],
    queryFn: () => jobsApi.recommendations(4),
  });
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => jobsApi.applications() });
  const notifs = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    enabled: user?.role === "admin",
  });
  const resume = useQuery({
    queryKey: ["resume"],
    queryFn: () => resumeApi.get(),
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false),
  });

  async function toggleSave(id: string) {
    await jobsApi.toggleSave(id);
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["saved"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const avgMatchRate =
    recs.data && recs.data.length > 0
      ? Math.round(
          recs.data.reduce((acc, job) => acc + (job.matchScore || 0), 0) /
            recs.data.length,
        )
      : null;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`${recs.data?.length ?? 0} high-signal matches found for you today.`}
      />

      {/* Resume processing alert */}
      {resume.data?.status === "processing" && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/8 border border-amber-200 dark:border-amber-500/20 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-9 grid place-items-center rounded-lg bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
              <Loader2 className="size-4 animate-spin" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles className="size-3.5 animate-pulse" />
                AI is analyzing your resume
              </h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                Extracting technical skills, years of experience, and role preferences to refine
                your match scores.
              </p>
            </div>
          </div>
          <Link
            to="/app/resume"
            className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0 flex items-center gap-1"
          >
            View status
            <ArrowRight className="size-3" />
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Match rate"
          value={avgMatchRate !== null ? `${avgMatchRate}%` : "—"}
          progress={avgMatchRate ?? undefined}
          icon={<Activity className="size-3.5" />}
        />
        <StatCard
          label="Active leads"
          value={recs.data?.length ?? "—"}
          icon={<Sparkles className="size-3.5" />}
        />
        <StatCard
          label="Applications"
          value={apps.data?.length ?? "—"}
          icon={<Send className="size-3.5" />}
        />
        <StatCard
          label="Interviews"
          value={apps.data?.filter((a) => a.status === "interviewing").length ?? "—"}
          icon={<Briefcase className="size-3.5" />}
        />
      </section>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top recommendations */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Top recommendations
            </h2>
            <Link
              to="/app/recommendations"
              className="text-xs font-semibold text-foreground hover:text-accent inline-flex items-center gap-1 transition-colors"
            >
              View all
              <ArrowRight className="size-3" />
            </Link>
          </div>
          {recs.isLoading ? (
            <LoadingState variant="job-list" count={3} />
          ) : recs.isError ? (
            <ErrorState onRetry={() => recs.refetch()} />
          ) : (
            <div className="space-y-3.5">
              {recs.data!.map((j) => (
                <JobCard key={j.id} job={j} onToggleSave={toggleSave} />
              ))}
            </div>
          )}
        </section>

        {/* Sidebar widgets */}
        <aside className="space-y-4">
          {/* Recent activity */}
          <div className="p-5 bg-card border border-border rounded-xl shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Recent activity
              </h3>
              {(notifs.data ?? []).some((n) => !n.read) && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 text-accent border border-accent/20">
                  <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                  New
                </span>
              )}
            </div>

            {notifs.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="skeleton-shimmer size-7 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="skeleton-shimmer h-3.5 rounded w-4/5" />
                      <div className="skeleton-shimmer h-2.5 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (notifs.data ?? []).length === 0 ? (
              <div className="text-center py-6 px-2">
                <div className="size-9 rounded-xl bg-surface border border-border grid place-items-center text-muted-foreground mx-auto mb-2.5">
                  <Inbox className="size-4 opacity-70" />
                </div>
                <p className="text-xs font-semibold text-foreground">No recent activity</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Interactions and updates will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {(notifs.data ?? []).slice(0, 4).map((n) => {
                  const meta = getActivityMeta(n.type);
                  const Icon = meta.icon;
                  return (
                    <li
                      key={n.id}
                      className="group flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-surface/60 transition-colors"
                    >
                      <div
                        className={`size-7 rounded-lg grid place-items-center shrink-0 border ${meta.badgeClass}`}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-medium truncate ${
                              n.read ? "text-foreground/90" : "font-semibold text-foreground"
                            }`}
                          >
                            {n.title}
                          </span>
                          {!n.read && (
                            <span className="size-1.5 rounded-full bg-accent shrink-0" />
                          )}
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {n.body}
                          </p>
                        )}
                        <div className="text-[10px] text-muted-foreground/80 font-mono mt-1">
                          {timeAgo(n.createdAt)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              to="/app/notifications"
              className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-semibold text-foreground hover:text-accent transition-colors"
            >
              <span>View all notifications</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>

          {/* System pipeline widget (admin only) */}
          {user?.role === "admin" && (
            <div className="p-5 bg-card border border-border rounded-xl shadow-card">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                System pipeline
              </h3>
              <div className="space-y-2.5 text-xs">
                <Row label="Worker nodes" value={`${12} active`} />
                <Row label="Queue latency" value={`${stats.data?.pipelineLatencyMs ?? "—"} ms`} />
                <Row label="Uptime" value={`${stats.data?.uptimePct ?? "—"}%`} />
              </div>
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-accent font-medium">
                  <Zap className="size-3" />
                  <span>All systems operational</span>
                </div>
              </div>
              <Link
                to="/app/admin"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-accent transition-colors"
              >
                Open admin
                <ArrowRight className="size-3" />
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground tabular-nums">{value}</span>
    </div>
  );
}
