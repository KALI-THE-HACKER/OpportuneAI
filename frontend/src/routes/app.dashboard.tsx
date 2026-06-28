import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Activity, Briefcase, Send, Sparkles } from "lucide-react";
import { jobsApi, adminApi, notificationsApi } from "@/lib/api";
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

function DashboardPage() {
  const { user } = useAuth();
  const recs = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => jobsApi.recommendations(4),
  });
  const apps = useQuery({ queryKey: ["applications"], queryFn: () => jobsApi.applications() });
  const notifs = useQuery({ queryKey: ["notifications"], queryFn: () => notificationsApi.list() });
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminApi.stats() });

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        description={`${recs.data?.length ?? 0} new high-signal matches found today.`}
      />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Match rate"
          value={`${stats.data?.avgMatchScore.toFixed(1) ?? "—"}%`}
          progress={stats.data?.avgMatchScore}
          icon={<Activity className="size-4" />}
        />
        <StatCard
          label="Active leads"
          value={recs.data?.length ?? "—"}
          icon={<Sparkles className="size-4" />}
        />
        <StatCard
          label="Applications"
          value={apps.data?.length ?? "—"}
          icon={<Send className="size-4" />}
        />
        <StatCard
          label="Interviews"
          value={apps.data?.filter((a) => a.status === "interviewing").length ?? "—"}
          icon={<Briefcase className="size-4" />}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Top recommendations
            </h2>
            <Link
              to="/app/recommendations"
              className="text-xs text-foreground hover:text-accent inline-flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          </div>
          {recs.isLoading ? (
            <LoadingState variant="job-list" count={3} />
          ) : recs.isError ? (
            <ErrorState onRetry={() => recs.refetch()} />
          ) : (
            <div className="space-y-4">
              {recs.data!.map((j) => (
                <JobCard key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-6">
          <div className="p-6 bg-card ring-1 ring-border rounded-lg">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Recent activity
            </h3>
            <ul className="space-y-3">
              {(notifs.data ?? []).slice(0, 4).map((n) => (
                <li key={n.id} className="text-sm">
                  <div className="text-foreground font-medium">{n.title}</div>
                  <div className="text-muted-foreground text-xs">{timeAgo(n.createdAt)}</div>
                </li>
              ))}
            </ul>
            <Link
              to="/app/notifications"
              className="mt-5 inline-flex items-center gap-1 text-xs text-foreground hover:text-accent"
            >
              All notifications <ArrowRight className="size-3" />
            </Link>
          </div>

          <div className="p-6 bg-card ring-1 ring-border rounded-lg">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              System pipeline
            </h3>
            <div className="space-y-3 text-xs">
              <Row label="Worker nodes" value={`${12} active`} />
              <Row label="Queue latency" value={`${stats.data?.pipelineLatencyMs ?? "—"} ms`} />
              <Row label="Uptime" value={`${stats.data?.uptimePct ?? "—"}%`} />
            </div>
            <Link
              to="/app/admin"
              className="mt-5 inline-flex items-center gap-1 text-xs text-foreground hover:text-accent"
            >
              Open admin <ArrowRight className="size-3" />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
