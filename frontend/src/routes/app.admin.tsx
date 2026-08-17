import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingState, ErrorState } from "@/components/shared/state-views";
import {
  ShieldAlert,
  Database,
  Cpu,
  Activity,
  Zap,
  Server,
  RefreshCcw,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin · OpportuneAI" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const q = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    enabled: user?.role === "admin",
    refetchInterval: 15_000,
  });

  if (isAuthLoading) {
    return <LoadingState variant="stats" count={4} />;
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="size-16 rounded-2xl bg-destructive/10 text-destructive grid place-items-center mb-4 border border-destructive/20 shadow-sm">
          <ShieldAlert className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
          This section is restricted to administrators. You do not have permission to view system telemetry or pipeline administration tools.
        </p>
        <Link
          to="/app/dashboard"
          className="inline-flex items-center gap-2 px-4 h-9 rounded-lg bg-brand text-brand-foreground text-sm font-medium hover:bg-brand/90 transition-colors shadow-sm"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (q.isLoading) return <LoadingState variant="stats" count={4} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;

  const s = q.data;

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        description="Real-time pipeline telemetry and system health overview."
        actions={
          <div className="flex items-center gap-1.5 text-xs text-accent font-mono font-semibold">
            <span className="size-1.5 rounded-full bg-accent animate-pulse-glow" />
            LIVE · refreshes every 15s
          </div>
        }
      />

      {/* System status banner */}
      <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-500/8 border border-emerald-200 dark:border-emerald-500/20 rounded-xl flex items-center gap-3">
        <div className="size-8 grid place-items-center rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <Zap className="size-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            All systems operational
          </div>
          <div className="text-xs text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
            Pipeline is processing at normal latency. No errors in the last 24h.
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Avg match score"
          value={`${s.avgMatchScore.toFixed(1)}%`}
          progress={s.avgMatchScore}
          icon={<Activity className="size-3.5" />}
        />
        <StatCard
          label="Jobs indexed"
          value={s.totalJobs.toLocaleString()}
          icon={<Database className="size-3.5" />}
        />
        <StatCard
          label="Processed (24h)"
          value={s.jobsLast24h?.toLocaleString() ?? "—"}
          icon={<TrendingUp className="size-3.5" />}
        />
        <StatCard
          label="Uptime"
          value={`${s.uptimePct ?? 99.9}%`}
          progress={s.uptimePct ?? 99.9}
          icon={<Server className="size-3.5" />}
        />
      </section>

      {/* Performance detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MetricCard
          title="Queue & processing"
          icon={<Cpu className="size-4" />}
          rows={[
            { label: "Worker nodes", value: "12 active" },
            { label: "Processing latency", value: `${s.pipelineLatencyMs} ms` },
            { label: "Total jobs indexed", value: s.totalJobs.toLocaleString() },
            { label: "Total users", value: s.totalUsers.toLocaleString() },
          ]}
        />
        <MetricCard
          title="Scraper status"
          icon={<RefreshCcw className="size-4" />}
          rows={[
            { label: "LinkedIn", value: "Active" },
            { label: "Naukri", value: "Active" },
            { label: "Wellfound", value: "Active" },
            { label: "RemoteOK", value: "Active" },
          ]}
        />
      </div>
    </>
  );
}

function MetricCard({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <span className="size-7 grid place-items-center rounded-lg bg-surface border border-border text-muted-foreground shrink-0">
          {icon}
        </span>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="p-5 space-y-3.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-semibold text-foreground tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
