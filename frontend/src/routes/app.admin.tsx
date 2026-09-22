import { useState, useRef, useCallback, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  adminApi,
  type SystemStats,
  type ScraperHealth,
  type ScraperRunItem,
  type ScraperRunDetail,
  type QueueTelemetry,
  type LogItem,
  type ConfigCategory,
  type SystemApiKeyItem,
  type AuditLogItem,
} from "@/lib/api/admin";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingState, ErrorState } from "@/components/shared/state-views";
import { toast } from "sonner";
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
  Play,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Settings2,
  KeyRound,
  BellRing,
  History,
  Trash2,
  Plus,
  Eye,
  Sliders,
  Send,
  Download,
  Search,
  Filter,
  Check,
  Shield,
  Layers,
  Lock,
  Loader2,
  Mail,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin Control Plane · OpportuneAI" }] }),
  component: AdminControlPlane,
});

type TabType = "overview" | "scrapers" | "queue" | "logs" | "config" | "notifications" | "audit";

function AdminControlPlane() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>("overview");

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
          This section is restricted to administrators. You do not have permission to view system
          telemetry or pipeline administration tools.
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

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Admin Control Plane"
        description="Enterprise operational control plane, scraper orchestration, live telemetry, and security vault."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-mono font-medium">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE TELEMETRY · 15s
            </div>
          </div>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px scrollbar-none">
        <TabButton
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          icon={<Activity className="size-4" />}
          label="Overview"
        />
        <TabButton
          active={activeTab === "scrapers"}
          onClick={() => setActiveTab("scrapers")}
          icon={<RefreshCcw className="size-4" />}
          label="Scrapers & Pipeline"
        />
        <TabButton
          active={activeTab === "queue"}
          onClick={() => setActiveTab("queue")}
          icon={<Cpu className="size-4" />}
          label="Queues & Workers"
        />
        <TabButton
          active={activeTab === "logs"}
          onClick={() => setActiveTab("logs")}
          icon={<Terminal className="size-4" />}
          label="Live Logs"
        />
        <TabButton
          active={activeTab === "config"}
          onClick={() => setActiveTab("config")}
          icon={<Settings2 className="size-4" />}
          label="Config & Secrets"
        />
        <TabButton
          active={activeTab === "notifications"}
          onClick={() => setActiveTab("notifications")}
          icon={<BellRing className="size-4" />}
          label="Alerts & Emails"
        />
        <TabButton
          active={activeTab === "audit"}
          onClick={() => setActiveTab("audit")}
          icon={<History className="size-4" />}
          label="Audit Trail"
        />
      </div>

      {/* Active Tab View */}
      {activeTab === "overview" && <OverviewTab onNavigate={setActiveTab} />}
      {activeTab === "scrapers" && <ScrapersTab />}
      {activeTab === "queue" && <QueueTab />}
      {activeTab === "logs" && <LogsTab />}
      {activeTab === "config" && <ConfigTab />}
      {activeTab === "notifications" && <NotificationsTab />}
      {activeTab === "audit" && <AuditTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all whitespace-nowrap ${
        active
          ? "border-brand text-brand bg-brand/5 dark:bg-brand/10 font-semibold"
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-surface/50"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ========================================================================= */
/* 1. OVERVIEW TAB                                                           */
/* ========================================================================= */

function OverviewTab({ onNavigate }: { onNavigate: (tab: TabType) => void }) {
  const qc = useQueryClient();
  const qStats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.stats(),
    refetchInterval: 15_000,
  });

  const qScrapers = useQuery({
    queryKey: ["admin-scrapers"],
    queryFn: () => adminApi.scrapers(),
    refetchInterval: 15_000,
  });

  const triggerAllMutation = useMutation({
    mutationFn: () => adminApi.triggerScraper("all"),
    onSuccess: (data) => {
      toast.success(data.message || "All scrapers triggered successfully");
      qc.invalidateQueries({ queryKey: ["admin-scrapers"] });
      qc.invalidateQueries({ queryKey: ["admin-scraper-runs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to trigger scrapers");
    },
  });

  if (qStats.isLoading || qScrapers.isLoading) {
    return <LoadingState variant="stats" count={4} />;
  }

  if (qStats.isError || !qStats.data) {
    return <ErrorState onRetry={() => qStats.refetch()} />;
  }

  const s = qStats.data;
  const scrapers = qScrapers.data || [];

  return (
    <div className="space-y-6">
      {/* System Status Banner */}
      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-9 grid place-items-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Zap className="size-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground flex items-center gap-2">
              All Systems Operational
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Scheduled Daily Scrapers run at 02:00 UTC · Ingestion rate nominal · Redis queues
              healthy
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => triggerAllMutation.mutate()}
            disabled={triggerAllMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-semibold hover:bg-brand/90 transition shadow-sm disabled:opacity-50"
          >
            <Play className="size-3.5 fill-current" />
            {triggerAllMutation.isPending ? "Triggering..." : "Run All Scrapers"}
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total jobs indexed"
          value={s.totalJobs.toLocaleString()}
          icon={<Database className="size-4 text-brand" />}
        />
        <StatCard
          label="Jobs (last 24h)"
          value={s.jobsLast24h.toLocaleString()}
          icon={<TrendingUp className="size-4 text-emerald-500" />}
        />
        <StatCard
          label="Applications (24h)"
          value={s.applicationsLast24h.toLocaleString()}
          icon={<Activity className="size-4 text-amber-500" />}
        />
        <StatCard
          label="System Uptime"
          value={`${s.uptimePct}%`}
          progress={s.uptimePct}
          icon={<Server className="size-4 text-blue-500" />}
        />
      </section>

      {/* Secondary Queue Telemetry Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active RQ Workers
            </div>
            <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {s.activeWorkers} nodes
            </div>
          </div>
          <span className="p-2.5 rounded-xl bg-surface border border-border text-muted-foreground">
            <Cpu className="size-5" />
          </span>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Queued Jobs
            </div>
            <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">
              {s.queuedJobs.toLocaleString()}
            </div>
          </div>
          <span className="p-2.5 rounded-xl bg-surface border border-border text-muted-foreground">
            <Layers className="size-5" />
          </span>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-card flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Failed Jobs
            </div>
            <div
              className={`text-2xl font-bold mt-1 tabular-nums ${
                s.failedJobs > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {s.failedJobs}
            </div>
          </div>
          <span className="p-2.5 rounded-xl bg-surface border border-border text-muted-foreground">
            <AlertTriangle className="size-5" />
          </span>
        </div>
      </section>

      {/* Scrapers Health Matrix */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <RefreshCcw className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Scraper Provider Health</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("scrapers")}
            className="text-xs text-brand hover:underline font-medium"
          >
            Manage Scrapers →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
          {scrapers.map((p) => (
            <div key={p.provider} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-sm">{p.name}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Indexed:</span>
                  <span className="font-semibold text-foreground">
                    {p.total_jobs_indexed.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-semibold text-foreground">{p.success_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Run:</span>
                  <span className="font-semibold text-foreground">
                    {p.last_run_at
                      ? new Date(p.last_run_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Never"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 2. SCRAPERS & PIPELINE ORCHESTRATION TAB                                   */
/* ========================================================================= */

function ScrapersTab() {
  const qc = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const qScrapers = useQuery({
    queryKey: ["admin-scrapers"],
    queryFn: () => adminApi.scrapers(),
    refetchInterval: 8_000,
  });

  const qRuns = useQuery({
    queryKey: ["admin-scraper-runs", providerFilter, statusFilter],
    queryFn: () =>
      adminApi.scraperRuns({
        provider: providerFilter !== "all" ? providerFilter : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        pageSize: 25,
      }),
    refetchInterval: 8_000,
  });

  const triggerMutation = useMutation({
    mutationFn: (provider: string) => adminApi.triggerScraper(provider),
    onSuccess: (data) => {
      toast.success(data.message || "Scraper triggered");
      qc.invalidateQueries({ queryKey: ["admin-scrapers"] });
      qc.invalidateQueries({ queryKey: ["admin-scraper-runs"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to trigger scraper"),
  });

  const cancelMutation = useMutation({
    mutationFn: (runId: number) => adminApi.cancelScraperRun(runId),
    onSuccess: (data) => {
      toast.success(data.message || "Cancellation sent");
      qc.invalidateQueries({ queryKey: ["admin-scraper-runs"] });
      qc.invalidateQueries({ queryKey: ["admin-scrapers"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to cancel run"),
  });

  const retryMutation = useMutation({
    mutationFn: (runId: number) => adminApi.retryScraperRun(runId),
    onSuccess: (data) => {
      toast.success(data.message || "Retry initiated");
      qc.invalidateQueries({ queryKey: ["admin-scraper-runs"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to retry run"),
  });

  const scrapers = qScrapers.data || [];
  const runs = qRuns.data?.items || [];

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Scraper Orchestrator</h3>
          <p className="text-xs text-muted-foreground">
            Trigger individual or batch crawls, observe real-time execution states, 2h anti-bot
            retry policies, and execution logs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => triggerMutation.mutate("all")}
          disabled={triggerMutation.isPending}
          className="inline-flex items-center justify-center gap-2 px-4 h-9 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition shadow-sm disabled:opacity-50"
        >
          <Play className="size-3.5 fill-current" />
          {triggerMutation.isPending ? "Triggering..." : "Trigger All Scrapers"}
        </button>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scrapers.map((p) => (
          <div
            key={p.provider}
            className="bg-card border border-border rounded-xl p-4 shadow-card flex flex-col justify-between space-y-4"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-foreground text-base">{p.name}</span>
                <StatusBadge status={p.status} />
              </div>

              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Indexed Jobs:</span>
                  <span className="font-semibold text-foreground">
                    {p.total_jobs_indexed.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className="font-semibold text-foreground">{p.success_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Duration:</span>
                  <span className="font-semibold text-foreground">
                    {(p.avg_duration_ms / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scheduled Daily:</span>
                  <span className="font-semibold text-foreground">02:00 UTC</span>
                </div>
                {p.next_retry_at && (
                  <div className="flex justify-between text-amber-500 font-medium">
                    <span>Retry Due:</span>
                    <span>
                      {new Date(p.next_retry_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {p.last_error && (
                  <div className="p-2 bg-destructive/10 border border-destructive/20 rounded text-[11px] text-destructive truncate">
                    {p.last_error}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => triggerMutation.mutate(p.provider)}
              disabled={p.is_running || triggerMutation.isPending}
              className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface/80 transition disabled:opacity-50"
            >
              <Play className="size-3 fill-current text-brand" />
              {p.is_running ? "Running..." : "Run Now"}
            </button>
          </div>
        ))}
      </div>

      {/* Scraper Runs Table */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Pipeline Execution History</h3>
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by provider"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="all">All Providers</option>
              <option value="linkedin">LinkedIn</option>
              <option value="naukri">Naukri</option>
              <option value="wellfound">Wellfound</option>
              <option value="remoteok">RemoteOK</option>
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-surface border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="running">Running</option>
              <option value="failed">Failed</option>
              <option value="retrying">Retrying</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-semibold">Run ID</th>
                <th className="p-3 font-semibold">Provider</th>
                <th className="p-3 font-semibold">Trigger</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Started At</th>
                <th className="p-3 font-semibold">Duration</th>
                <th className="p-3 font-semibold">Fetched / Saved</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-muted-foreground">
                    No scraper runs found matching filters.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/30 transition">
                    <td className="p-3 font-mono font-bold text-foreground">#{r.id}</td>
                    <td className="p-3 font-semibold text-foreground uppercase">{r.provider}</td>
                    <td className="p-3 capitalize text-muted-foreground">{r.trigger_type}</td>
                    <td className="p-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(r.started_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="p-3 tabular-nums text-foreground">
                      {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </td>
                    <td className="p-3 font-semibold text-foreground tabular-nums">
                      {r.items_fetched} / {r.items_saved}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedRunId(r.id)}
                          className="px-2 py-1 rounded bg-surface border border-border text-foreground hover:bg-surface/80 transition"
                          title="View Execution Logs"
                        >
                          <Eye className="size-3.5" />
                        </button>
                        {r.status === "running" && (
                          <button
                            type="button"
                            onClick={() => cancelMutation.mutate(r.id)}
                            className="px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition"
                            title="Cancel Run"
                          >
                            <XCircle className="size-3.5" />
                          </button>
                        )}
                        {(r.status === "failed" || r.status === "retrying") && (
                          <button
                            type="button"
                            onClick={() => retryMutation.mutate(r.id)}
                            className="px-2 py-1 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition"
                            title="Retry Run"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Run Detail Modal */}
      {selectedRunId && (
        <RunDetailModal runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
      )}
    </div>
  );
}

function RunDetailModal({ runId, onClose }: { runId: number; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["admin-run-detail", runId],
    queryFn: () => adminApi.scraperRunDetails(runId),
  });

  const detail = q.data;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface/50">
          <div className="flex items-center gap-2.5">
            <span className="size-8 rounded-lg bg-brand/10 text-brand grid place-items-center font-mono font-bold text-xs">
              #{runId}
            </span>
            <div>
              <h3 className="text-sm font-bold text-foreground">
                Run #{runId} · {detail?.provider.toUpperCase()}
              </h3>
              <p className="text-xs text-muted-foreground capitalize">
                Trigger: {detail?.trigger_type} · Status: {detail?.status}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition"
          >
            <XCircle className="size-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {q.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading run details...
            </div>
          ) : !detail ? (
            <div className="p-8 text-center text-sm text-destructive">
              Failed to load run details.
            </div>
          ) : (
            <>
              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-3 bg-surface rounded-lg border border-border">
                  <div className="text-muted-foreground">Items Fetched</div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {detail.items_fetched}
                  </div>
                </div>
                <div className="p-3 bg-surface rounded-lg border border-border">
                  <div className="text-muted-foreground">Items Saved</div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {detail.items_saved}
                  </div>
                </div>
                <div className="p-3 bg-surface rounded-lg border border-border">
                  <div className="text-muted-foreground">Duration</div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {detail.duration_ms ? `${(detail.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </div>
                </div>
                <div className="p-3 bg-surface rounded-lg border border-border">
                  <div className="text-muted-foreground">Retries</div>
                  <div className="text-base font-bold text-foreground mt-0.5">
                    {detail.retry_count} / {detail.max_retries}
                  </div>
                </div>
              </div>

              {detail.error_message && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl space-y-1 text-xs">
                  <div className="font-bold text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="size-4" />
                    Error Encountered
                  </div>
                  <div className="text-destructive font-mono whitespace-pre-wrap">
                    {detail.error_message}
                  </div>
                  {detail.stack_trace && (
                    <details className="mt-2 text-[11px] text-muted-foreground">
                      <summary className="cursor-pointer hover:underline font-semibold">
                        View Stack Trace
                      </summary>
                      <pre className="p-2 bg-background/50 rounded font-mono mt-1 overflow-x-auto text-foreground">
                        {detail.stack_trace}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Execution Logs */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Structured Execution Logs
                </div>
                <div className="bg-zinc-950 text-zinc-100 rounded-xl p-3 font-mono text-xs max-h-60 overflow-y-auto space-y-1">
                  {detail.logs.length === 0 ? (
                    <div className="text-zinc-500 italic">No execution logs recorded.</div>
                  ) : (
                    detail.logs.map((l, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-zinc-500 select-none">
                          {l.timestamp.slice(11, 19)}
                        </span>
                        <span
                          className={`font-bold px-1 rounded text-[10px] ${
                            l.level === "ERROR" || l.level === "CRITICAL"
                              ? "bg-red-500/20 text-red-400"
                              : l.level === "WARN"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {l.level}
                        </span>
                        <span className="text-zinc-200 flex-1">{l.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 3. QUEUE & WORKERS TAB                                                    */
/* ========================================================================= */

function QueueTab() {
  const qc = useQueryClient();
  const qQueue = useQuery({
    queryKey: ["admin-queue"],
    queryFn: () => adminApi.queue(),
    refetchInterval: 5_000,
  });

  const retryFailedMutation = useMutation({
    mutationFn: () => adminApi.retryFailedQueue(),
    onSuccess: (data) => {
      toast.success(data.message || "Requeued failed jobs");
      qc.invalidateQueries({ queryKey: ["admin-queue"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to retry jobs"),
  });

  const clearFailedMutation = useMutation({
    mutationFn: () => adminApi.clearFailedQueue(),
    onSuccess: (data) => {
      toast.success(data.message || "Purged failed jobs registry");
      qc.invalidateQueries({ queryKey: ["admin-queue"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to clear registry"),
  });

  if (qQueue.isLoading) return <LoadingState variant="stats" count={3} />;
  const data = qQueue.data;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 rounded-xl border border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">Redis Queue (RQ) Telemetry</h3>
          <p className="text-xs text-muted-foreground">
            Monitor asynchronous worker tasks (AI Extraction, Resume Parsing, Scraper Ingestion).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => retryFailedMutation.mutate()}
            disabled={retryFailedMutation.isPending || (data?.total_failed || 0) === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-semibold text-foreground hover:bg-surface/80 transition disabled:opacity-50"
          >
            <RotateCcw className="size-3.5 text-amber-500" />
            Retry All Failed ({data?.total_failed || 0})
          </button>
          <button
            type="button"
            onClick={() => clearFailedMutation.mutate()}
            disabled={clearFailedMutation.isPending || (data?.total_failed || 0) === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive hover:bg-destructive/20 transition disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Purge Failed
          </button>
        </div>
      </div>

      {/* Queues list */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data?.queues.map((q) => (
          <div
            key={q.name}
            className="p-5 bg-card border border-border rounded-xl shadow-card space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground text-sm flex items-center gap-2">
                <Layers className="size-4 text-brand" />
                {q.name}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  q.is_empty ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand"
                }`}
              >
                {q.is_empty ? "IDLE" : "ACTIVE"}
              </span>
            </div>

            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Queued Jobs:</span>
                <span className="font-bold text-foreground tabular-nums">{q.queued_jobs}</span>
              </div>
              <div className="flex justify-between">
                <span>Failed Registry:</span>
                <span
                  className={`font-bold tabular-nums ${
                    q.failed_jobs > 0 ? "text-destructive" : "text-foreground"
                  }`}
                >
                  {q.failed_jobs}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Active Worker Nodes */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">
              Active Worker Nodes ({data?.workers.length || 0})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">Refreshes every 5s</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-semibold">Worker Node ID</th>
                <th className="p-3 font-semibold">State</th>
                <th className="p-3 font-semibold">Listening Queues</th>
                <th className="p-3 font-semibold">Current Job</th>
                <th className="p-3 font-semibold">Success Count</th>
                <th className="p-3 font-semibold">Failed Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!data?.workers || data.workers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No active RQ worker instances detected on Redis connection.
                  </td>
                </tr>
              ) : (
                data.workers.map((w) => (
                  <tr key={w.id} className="hover:bg-surface/30 transition">
                    <td className="p-3 font-mono font-semibold text-foreground">{w.name}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize">
                        {w.state}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">{w.queues.join(", ")}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground">
                      {w.current_job_id || "None (idle)"}
                    </td>
                    <td className="p-3 tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                      {w.successful_job_count}
                    </td>
                    <td className="p-3 tabular-nums font-semibold text-destructive">
                      {w.failed_job_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 4. LIVE LOGS & OBSERVABILITY TAB                                          */
/* ========================================================================= */

function LogsTab() {
  const [level, setLevel] = useState<string>("ALL");
  const [source, setSource] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);

  const qLogs = useQuery({
    queryKey: ["admin-live-logs", level, source, search],
    queryFn: () => adminApi.logs({ level, source, search: search || undefined, limit: 150 }),
    refetchInterval: 3_000,
  });

  const logs = qLogs.data || [];

  const handleDownload = () => {
    const text = logs
      .map((l) => `${l.timestamp} [${l.level}] ${l.logger}: ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opportune-logs-${new Date().toISOString()}.log`;
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Control Bar */}
      <div className="p-4 bg-surface border border-border rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Level filter */}
          <select
            aria-label="Filter by level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
          >
            <option value="ALL">All Levels</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>

          {/* Source filter */}
          <select
            aria-label="Filter by source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="text-xs bg-card border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
          >
            <option value="all">All Sources</option>
            <option value="api">API</option>
            <option value="ingestion">Ingestion</option>
            <option value="scraper">Scrapers</option>
            <option value="scheduler">Scheduler</option>
            <option value="ai">AI Workers</option>
          </select>

          {/* Search box */}
          <div className="relative">
            <Search className="size-3.5 absolute left-2.5 top-2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand w-48"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition font-medium ${
              autoScroll
                ? "bg-brand/10 border-brand/20 text-brand"
                : "bg-card border-border text-muted-foreground"
            }`}
          >
            Auto-refresh: 3s
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-card border border-border text-foreground hover:bg-surface transition font-semibold"
          >
            <Download className="size-3.5" />
            Export Log
          </button>
        </div>
      </div>

      {/* Terminal Display */}
      <div className="bg-zinc-950 text-zinc-100 border border-zinc-800 rounded-xl p-4 font-mono text-xs h-[500px] overflow-y-auto space-y-1.5 shadow-2xl">
        {logs.length === 0 ? (
          <div className="text-zinc-500 italic py-12 text-center">
            No logs matching active filters.
          </div>
        ) : (
          logs.map((l, i) => (
            <div
              key={i}
              className="flex items-start gap-2.5 leading-relaxed hover:bg-zinc-900/60 p-0.5 rounded"
            >
              <span className="text-zinc-500 shrink-0 select-none">
                {l.timestamp.slice(11, 23)}
              </span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                  l.level === "ERROR" || l.level === "CRITICAL"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : l.level === "WARN"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                }`}
              >
                {l.level}
              </span>
              <span className="text-zinc-400 shrink-0">[{l.logger}]</span>
              <span className="text-zinc-200 flex-1 break-words">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 5. SYSTEM CONFIG & SECRETS VAULT TAB                                      */
/* ========================================================================= */

function ConfigTab() {
  const qc = useQueryClient();
  const [isAddKeyOpen, setIsAddKeyOpen] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Track active debounces and latest values for immediate blur flush
  const debounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const localValuesRef = useRef<Record<string, any>>({});
  localValuesRef.current = localValues;

  const qConfigs = useQuery({
    queryKey: ["admin-configs"],
    queryFn: () => adminApi.configs(),
  });

  const qKeys = useQuery({
    queryKey: ["admin-api-keys"],
    queryFn: () => adminApi.apiKeys(),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (payload: { key: string; value: any }) => adminApi.updateConfig(payload),
    onMutate: async (newConfig) => {
      setSaveStatus("saving");
      await qc.cancelQueries({ queryKey: ["admin-configs"] });
      const previousConfigs = qc.getQueryData<Record<string, ConfigCategory>>(["admin-configs"]);

      // Optimistically update React Query cache immediately
      qc.setQueryData<Record<string, ConfigCategory>>(["admin-configs"], (old) => {
        if (!old || !old[newConfig.key]) return old;
        return {
          ...old,
          [newConfig.key]: {
            ...old[newConfig.key],
            value: newConfig.value,
            updated_at: new Date().toISOString(),
          },
        };
      });

      return { previousConfigs };
    },
    onSuccess: (data) => {
      setSaveStatus("saved");
      toast.success(data.message || "Config updated");
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
    onError: (err: any, _newConfig, context) => {
      setSaveStatus("error");
      if (context?.previousConfigs) {
        qc.setQueryData(["admin-configs"], context.previousConfigs);
      }
      toast.error(err.message || "Failed to update config");
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: number) => adminApi.deleteApiKey(keyId),
    onSuccess: (data) => {
      toast.success(data.message || "API key revoked");
      qc.invalidateQueries({ queryKey: ["admin-api-keys"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to revoke key"),
  });

  const serverConfigs = qConfigs.data || {};
  const apiKeys = qKeys.data || [];

  // Active merged configs: local overrides take precedence for 0ms live typing/sliding
  const activeConfigs = useMemo(() => {
    const merged: Record<string, ConfigCategory> = { ...serverConfigs };
    for (const [k, v] of Object.entries(localValues)) {
      if (merged[k]) {
        merged[k] = { ...merged[k], value: v };
      }
    }
    return merged;
  }, [serverConfigs, localValues]);

  // Dispatcher: updates local state immediately, then debounces backend PUT request
  const saveConfig = useCallback(
    (key: string, updatedValue: any, immediate = false) => {
      setLocalValues((prev) => ({ ...prev, [key]: updatedValue }));
      setSaveStatus("saving");

      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
        delete debounceTimers.current[key];
      }

      const doSave = () => {
        delete debounceTimers.current[key];
        updateConfigMutation.mutate({ key, value: updatedValue });
      };

      if (immediate) {
        doSave();
      } else {
        debounceTimers.current[key] = setTimeout(doSave, 500);
      }
    },
    [updateConfigMutation],
  );

  // Flush pending save immediately on blur so leaving the field saves without delay
  const flushSave = useCallback(
    (key: string) => {
      if (debounceTimers.current[key]) {
        clearTimeout(debounceTimers.current[key]);
        delete debounceTimers.current[key];
        const pendingVal = localValuesRef.current[key];
        if (pendingVal !== undefined) {
          updateConfigMutation.mutate({ key, value: pendingVal });
        }
      }
    },
    [updateConfigMutation],
  );

  const handleFieldChange = (key: string, field: string, value: any, immediate = false) => {
    const currentCategory = activeConfigs[key]?.value || {};
    const updated = { ...currentCategory, [field]: value };
    saveConfig(key, updated, immediate);
  };

  return (
    <div className="space-y-8">
      {/* Live Sync Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/40">
        <div>
          <h2 className="text-sm font-bold text-foreground">Configuration & Secrets Engine</h2>
          <p className="text-xs text-muted-foreground">
            Adjust runtime parameters and credentials live. Changes are saved automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500 font-medium bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <Loader2 className="size-3 animate-spin" /> Saving changes...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <Check className="size-3" /> Live synced
            </span>
          )}
          {saveStatus === "error" && (
            <span className="flex items-center gap-1.5 text-xs text-destructive font-medium bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20">
              <AlertTriangle className="size-3" /> Save failed
            </span>
          )}
        </div>
      </div>

      {/* 1. LLM Settings */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Sliders className="size-4 text-brand" />
          <h3 className="text-sm font-bold text-foreground">LLM Provider & Model Selection</h3>
        </div>

        {activeConfigs.llm_config && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                LLM Provider
              </label>
              <select
                value={activeConfigs.llm_config.value?.provider || "gemini"}
                onChange={(e) => handleFieldChange("llm_config", "provider", e.target.value, true)}
                className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
              >
                <option value="gemini">Google Gemini (Recommended)</option>
                <option value="openrouter">OpenRouter (Multi-model gateway)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {activeConfigs.llm_config.value?.provider === "openrouter"
                  ? "OpenRouter Model"
                  : "Gemini Model"}
              </label>
              {activeConfigs.llm_config.value?.provider === "openrouter" ? (
                <input
                  type="text"
                  value={
                    activeConfigs.llm_config.value?.openrouter_model ?? "openai/gpt-oss-120b:free"
                  }
                  onChange={(e) =>
                    handleFieldChange("llm_config", "openrouter_model", e.target.value, false)
                  }
                  onBlur={() => flushSave("llm_config")}
                  placeholder="e.g. openai/gpt-4o-mini"
                  className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                />
              ) : (
                <select
                  value={activeConfigs.llm_config.value?.model || "gemini-2.5-flash"}
                  onChange={(e) => handleFieldChange("llm_config", "model", e.target.value, true)}
                  className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
                >
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Structured)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (High Reasoning)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Temperature ({activeConfigs.llm_config.value?.temperature ?? 0.0})
              </label>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.1"
                value={activeConfigs.llm_config.value?.temperature ?? 0.0}
                onChange={(e) =>
                  handleFieldChange("llm_config", "temperature", parseFloat(e.target.value), false)
                }
                onBlur={() => flushSave("llm_config")}
                className="w-full accent-brand mt-2"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Retry Policy & Anti-Bot Protection */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <RotateCcw className="size-4 text-brand" />
          <h3 className="text-sm font-bold text-foreground">
            Scraper Retry Policies & Anti-Bot Strategy
          </h3>
        </div>

        {activeConfigs.retry_policy && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Max Retries Before Permanent Failure
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={activeConfigs.retry_policy.value?.max_retries ?? 3}
                onChange={(e) =>
                  handleFieldChange(
                    "retry_policy",
                    "max_retries",
                    parseInt(e.target.value) || 1,
                    false,
                  )
                }
                onBlur={() => flushSave("retry_policy")}
                className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Base Exponential Backoff (seconds)
              </label>
              <input
                type="number"
                min="10"
                max="600"
                value={activeConfigs.retry_policy.value?.base_backoff_seconds ?? 60}
                onChange={(e) =>
                  handleFieldChange(
                    "retry_policy",
                    "base_backoff_seconds",
                    parseInt(e.target.value) || 10,
                    false,
                  )
                }
                onBlur={() => flushSave("retry_policy")}
                className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-surface rounded-lg border border-border">
                <input
                  type="checkbox"
                  checked={activeConfigs.retry_policy.value?.retry_after_2h_on_blocked ?? true}
                  onChange={(e) =>
                    handleFieldChange(
                      "retry_policy",
                      "retry_after_2h_on_blocked",
                      e.target.checked,
                      true,
                    )
                  }
                  className="rounded text-brand accent-brand size-4"
                />
                <span className="text-xs font-semibold text-foreground">
                  Delay 2 Hours when Blocked / Rate-Limited (429 / Captcha)
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 3. Daily 2 AM Cron Scheduler */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Clock className="size-4 text-brand" />
          <h3 className="text-sm font-bold text-foreground">Automated Daily Scheduler</h3>
        </div>

        {activeConfigs.scheduler_config && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Cron Expression (Default: 2:00 AM UTC)
              </label>
              <input
                type="text"
                value={activeConfigs.scheduler_config.value?.cron_expression ?? "0 2 * * *"}
                onChange={(e) =>
                  handleFieldChange("scheduler_config", "cron_expression", e.target.value, false)
                }
                onBlur={() => flushSave("scheduler_config")}
                className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand"
              />
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-surface rounded-lg border border-border">
                <input
                  type="checkbox"
                  checked={activeConfigs.scheduler_config.value?.enabled ?? true}
                  onChange={(e) =>
                    handleFieldChange("scheduler_config", "enabled", e.target.checked, true)
                  }
                  className="rounded text-brand accent-brand size-4"
                />
                <span className="text-xs font-semibold text-foreground">
                  Scheduler Active (triggers daily ingestion)
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* 4. Encrypted API Key Vault */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Encrypted API Key Vault</h3>
          </div>

          <button
            type="button"
            onClick={() => setIsAddKeyOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition shadow-sm"
          >
            <Plus className="size-3.5" />
            Add Secure Key
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-semibold">Provider</th>
                <th className="p-3 font-semibold">Label</th>
                <th className="p-3 font-semibold">Masked Secret Value</th>
                <th className="p-3 font-semibold">Created By</th>
                <th className="p-3 font-semibold">Created Date</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No custom encrypted keys saved. Using server environment keys.
                  </td>
                </tr>
              ) : (
                apiKeys.map((k) => (
                  <tr key={k.id} className="hover:bg-surface/30 transition">
                    <td className="p-3 font-bold uppercase text-foreground">{k.provider}</td>
                    <td className="p-3 font-medium text-foreground">{k.label}</td>
                    <td className="p-3 font-mono text-muted-foreground">{k.masked_key}</td>
                    <td className="p-3 text-muted-foreground">{k.created_by_email || "system"}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteKeyMutation.mutate(k.id)}
                        className="px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition text-xs font-medium"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Key Modal */}
      {isAddKeyOpen && <AddApiKeyModal onClose={() => setIsAddKeyOpen(false)} />}
    </div>
  );
}

function AddApiKeyModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState("gemini");
  const [label, setLabel] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const addKeyMutation = useMutation({
    mutationFn: () => adminApi.createApiKey({ provider, label, secret_key: secretKey }),
    onSuccess: (data) => {
      toast.success(data.message || "API key encrypted & registered");
      qc.invalidateQueries({ queryKey: ["admin-api-keys"] });
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to add API key"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !secretKey.trim()) {
      toast.error("Please fill in label and secret key");
      return;
    }
    addKeyMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm grid place-items-center p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">Add Encrypted API Key</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <XCircle className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openrouter">OpenRouter</option>
              <option value="firecrawl">Firecrawl</option>
              <option value="other">Other Service</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Key Label / Identifier
            </label>
            <input
              type="text"
              placeholder="e.g. Gemini Production Primary Key"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Secret Key Value
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Stored securely with AES Fernet encryption. Value is never displayed again.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-surface transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addKeyMutation.isPending}
              className="px-4 py-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition disabled:opacity-50"
            >
              {addKeyMutation.isPending ? "Encrypting..." : "Save Encrypted Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 6. ALERTS & NOTIFICATIONS TAB                                             */
/* ========================================================================= */

function NotificationsTab() {
  const qc = useQueryClient();
  const [newEmail, setNewEmail] = useState("");
  const [localNotif, setLocalNotif] = useState<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const localNotifRef = useRef<any>(null);
  localNotifRef.current = localNotif;

  const qConfigs = useQuery({
    queryKey: ["admin-configs"],
    queryFn: () => adminApi.configs(),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (payload: { key: string; value: any }) => adminApi.updateConfig(payload),
    onMutate: async (newConfig) => {
      await qc.cancelQueries({ queryKey: ["admin-configs"] });
      const previousConfigs = qc.getQueryData<Record<string, ConfigCategory>>(["admin-configs"]);

      // Optimistically update React Query cache immediately
      qc.setQueryData<Record<string, ConfigCategory>>(["admin-configs"], (old) => {
        if (!old || !old[newConfig.key]) return old;
        return {
          ...old,
          [newConfig.key]: {
            ...old[newConfig.key],
            value: newConfig.value,
            updated_at: new Date().toISOString(),
          },
        };
      });

      return { previousConfigs };
    },
    onSuccess: (data) => {
      toast.success(data.message || "Notification settings updated");
      qc.invalidateQueries({ queryKey: ["admin-audit-logs"] });
    },
    onError: (err: any, _newConfig, context) => {
      if (context?.previousConfigs) {
        qc.setQueryData(["admin-configs"], context.previousConfigs);
      }
      toast.error(err.message || "Failed to update settings");
    },
  });

  const testNotifMutation = useMutation({
    mutationFn: () => adminApi.sendTestNotification({ title: "Admin System Alert Test" }),
    onSuccess: (data: any) => {
      if (data.delivered === false || data.success === false) {
        toast.error(data.message || data.error || "Email delivery failed");
      } else {
        toast.success(data.message || "Test email dispatched successfully");
      }
    },
    onError: (err: any) => toast.error(err.message || "Failed to send test alert"),
  });

  const serverNotif = qConfigs.data?.notification_config?.value || {};
  const notifConfig = localNotif !== null ? localNotif : serverNotif;
  const recipientEmails: string[] = notifConfig.recipient_emails || [];

  const handleFieldChange = (field: string, value: any, immediate = false) => {
    const updated = { ...notifConfig, [field]: value };
    setLocalNotif(updated);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }

    const doSave = () => {
      updateConfigMutation.mutate({ key: "notification_config", value: updated });
    };

    if (immediate) {
      doSave();
    } else {
      debounceTimer.current = setTimeout(doSave, 500);
    }
  };

  const handleMultiChange = (patch: Record<string, any>) => {
    const updated = { ...notifConfig, ...patch };
    setLocalNotif(updated);
    updateConfigMutation.mutate({ key: "notification_config", value: updated });
  };

  const handleToggle = (field: string, value: boolean) => {
    handleFieldChange(field, value, true);
  };

  const flushSave = () => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
      if (localNotifRef.current) {
        updateConfigMutation.mutate({ key: "notification_config", value: localNotifRef.current });
      }
    }
  };

  const handleAddEmail = () => {
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    if (recipientEmails.includes(newEmail.trim())) {
      toast.error("Email already in recipient list");
      return;
    }
    const updated = {
      ...notifConfig,
      recipient_emails: [...recipientEmails, newEmail.trim()],
    };
    setLocalNotif(updated);
    updateConfigMutation.mutate({ key: "notification_config", value: updated });
    setNewEmail("");
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    const updated = {
      ...notifConfig,
      recipient_emails: recipientEmails.filter((e) => e !== emailToRemove),
    };
    setLocalNotif(updated);
    updateConfigMutation.mutate({ key: "notification_config", value: updated });
  };

  return (
    <div className="space-y-6">
      {/* Alert dispatch test banner */}
      <div className="p-4 bg-surface border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">Admin Alert Dispatch Engine</h3>
          <p className="text-xs text-muted-foreground">
            Automatic emails are triggered on Scraper Failures, Repeated Retries, Anti-Bot Blocks,
            and Critical System Errors.
          </p>
        </div>

        <button
          type="button"
          onClick={() => testNotifMutation.mutate()}
          disabled={testNotifMutation.isPending}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition shadow-sm disabled:opacity-50"
        >
          <Send className="size-3.5" />
          {testNotifMutation.isPending ? "Sending..." : "Send Test Email"}
        </button>
      </div>

      {/* SMTP Provider & Delivery Engine */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-brand" />
            <h3 className="text-sm font-bold text-foreground">
              SMTP Mail Send Provider & Service Setup
            </h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground">
            <input
              type="checkbox"
              checked={notifConfig.smtp_enabled ?? false}
              onChange={(e) => handleFieldChange("smtp_enabled", e.target.checked, true)}
              className="rounded text-brand accent-brand size-4"
            />
            <span>Enable Live SMTP Dispatch</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Provider Preset */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Mail Send Provider Preset
            </label>
            <select
              value={notifConfig.smtp_provider || "google"}
              onChange={(e) => {
                const prov = e.target.value;
                if (prov === "google") {
                  handleMultiChange({
                    smtp_provider: "google",
                    smtp_host: "smtp.gmail.com",
                    smtp_port: 587,
                    smtp_use_tls: true,
                    smtp_use_ssl: false,
                  });
                } else if (prov === "zoho") {
                  handleMultiChange({
                    smtp_provider: "zoho",
                    smtp_host: "smtp.zoho.com",
                    smtp_port: 465,
                    smtp_use_tls: false,
                    smtp_use_ssl: true,
                  });
                } else {
                  handleFieldChange("smtp_provider", "custom", true);
                }
              }}
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
            >
              <option value="google">Google (Gmail / Google Workspace)</option>
              <option value="zoho">Zoho Mail (Professional / Personal)</option>
              <option value="custom">Custom SMTP Server</option>
            </select>
          </div>

          {/* SMTP Host */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              SMTP Host
            </label>
            <input
              type="text"
              value={
                notifConfig.smtp_host ??
                (notifConfig.smtp_provider === "zoho" ? "smtp.zoho.com" : "smtp.gmail.com")
              }
              onChange={(e) => handleFieldChange("smtp_host", e.target.value, false)}
              onBlur={flushSave}
              placeholder="e.g. smtp.gmail.com"
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>

          {/* SMTP Port */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Port & Security Protocol
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={notifConfig.smtp_port ?? (notifConfig.smtp_provider === "zoho" ? 465 : 587)}
                onChange={(e) =>
                  handleFieldChange("smtp_port", parseInt(e.target.value) || 587, false)
                }
                onBlur={flushSave}
                className="w-24 text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <select
                value={notifConfig.smtp_use_ssl ? "ssl" : "tls"}
                onChange={(e) => {
                  const isSsl = e.target.value === "ssl";
                  handleMultiChange({
                    smtp_use_ssl: isSsl,
                    smtp_use_tls: !isSsl,
                    smtp_port: isSsl ? 465 : 587,
                  });
                }}
                className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="tls">STARTTLS (Port 587)</option>
                <option value="ssl">SSL / TLS (Port 465)</option>
              </select>
            </div>
          </div>

          {/* Username / Email */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              SMTP Username (Full Email Address)
            </label>
            <input
              type="text"
              value={notifConfig.smtp_user ?? ""}
              onChange={(e) => handleFieldChange("smtp_user", e.target.value, false)}
              onBlur={flushSave}
              placeholder="e.g. no-reply@luckylinux.dev"
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-mono"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Zoho and Google require full email address as login username.
            </p>
          </div>

          {/* Password / App Password */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              SMTP Password / App Password
            </label>
            <input
              type="password"
              value={notifConfig.smtp_pass ?? ""}
              onChange={(e) => handleFieldChange("smtp_pass", e.target.value, false)}
              onBlur={flushSave}
              placeholder="••••••••••••••••"
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Masked for security. Leave as •••••••• to preserve existing password.
            </p>
          </div>

          {/* From Address */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Sender From Header (Optional)
            </label>
            <input
              type="text"
              value={notifConfig.smtp_from ?? ""}
              onChange={(e) => handleFieldChange("smtp_from", e.target.value, false)}
              onBlur={flushSave}
              placeholder="OpportuneAI Alerts <alerts@domain.com>"
              className="w-full text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
        </div>

        {/* Provider Help Hint */}
        <div className="p-3 bg-surface/80 border border-border rounded-lg text-xs text-muted-foreground flex items-start gap-2">
          <Info className="size-4 text-brand shrink-0 mt-0.5" />
          <div>
            {(notifConfig.smtp_provider === "google" || !notifConfig.smtp_provider) && (
              <span>
                <strong>Google (Gmail):</strong> Requires 2-Step Verification enabled. Generate a
                16-character App Password at{" "}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline font-medium"
                >
                  myaccount.google.com/apppasswords
                </a>
                . Do not use your personal account password.
              </span>
            )}
            {notifConfig.smtp_provider === "zoho" && (
              <span>
                <strong>Zoho Mail:</strong> Uses SSL port 465 or STARTTLS 587. Requires a Zoho App
                Password generated from{" "}
                <a
                  href="https://accounts.zoho.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand underline font-medium"
                >
                  Zoho Accounts &gt; Security &gt; App Passwords
                </a>
                .
              </span>
            )}
            {notifConfig.smtp_provider === "custom" && (
              <span>
                <strong>Custom SMTP Relay:</strong> Configure any standard SMTP host, port,
                authentication credentials, and security mode. Also configurable via{" "}
                <code className="bg-surface px-1 py-0.5 rounded text-foreground">SMTP_*</code> in{" "}
                <code className="bg-surface px-1 py-0.5 rounded text-foreground">.env</code>.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Alert Event Toggles */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-foreground border-b border-border pb-3">
          Alert Trigger Events
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={notifConfig.alert_on_scraper_failure ?? true}
              onChange={(e) => handleToggle("alert_on_scraper_failure", e.target.checked)}
              className="rounded size-4 text-brand accent-brand"
            />
            <div>
              <div className="text-xs font-bold text-foreground">Scraper Permanent Failure</div>
              <div className="text-[11px] text-muted-foreground">
                When a crawler exhausts all retries
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={notifConfig.alert_on_provider_blocked ?? true}
              onChange={(e) => handleToggle("alert_on_provider_blocked", e.target.checked)}
              className="rounded size-4 text-brand accent-brand"
            />
            <div>
              <div className="text-xs font-bold text-foreground">Provider Anti-Bot Block / 429</div>
              <div className="text-[11px] text-muted-foreground">
                Rate limit triggers 2-hour backoff alert
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={notifConfig.alert_on_repeated_retry ?? true}
              onChange={(e) => handleToggle("alert_on_repeated_retry", e.target.checked)}
              className="rounded size-4 text-brand accent-brand"
            />
            <div>
              <div className="text-xs font-bold text-foreground">Repeated Retries</div>
              <div className="text-[11px] text-muted-foreground">
                Multiple consecutive retry attempts
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border cursor-pointer">
            <input
              type="checkbox"
              checked={notifConfig.alert_on_critical_error ?? true}
              onChange={(e) => handleToggle("alert_on_critical_error", e.target.checked)}
              className="rounded size-4 text-brand accent-brand"
            />
            <div>
              <div className="text-xs font-bold text-foreground">Critical Pipeline Errors</div>
              <div className="text-[11px] text-muted-foreground">
                Uncaught exceptions in workers or queues
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Recipient Emails Manager */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-foreground border-b border-border pb-3">
          Admin Notification Recipients
        </h3>

        <div className="flex gap-2">
          <input
            type="email"
            placeholder="admin@luckylinux.dev"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="flex-1 text-xs bg-surface border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="px-4 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition shadow-sm"
          >
            Add Recipient
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {recipientEmails.map((email) => (
            <span
              key={email}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-border text-xs font-medium text-foreground shadow-sm"
            >
              {email}
              <button
                type="button"
                onClick={() => handleRemoveEmail(email)}
                className="text-muted-foreground hover:text-destructive transition ml-1"
              >
                <XCircle className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* 7. AUDIT TRAIL TAB                                                        */
/* ========================================================================= */

function AuditTab() {
  const [actionFilter, setActionFilter] = useState("all");

  const qAudit = useQuery({
    queryKey: ["admin-audit-logs", actionFilter],
    queryFn: () =>
      adminApi.auditLogs({
        action: actionFilter !== "all" ? actionFilter : undefined,
        pageSize: 50,
      }),
  });

  const logs = qAudit.data?.items || [];

  return (
    <div className="space-y-4">
      <div className="p-4 bg-surface border border-border rounded-xl flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-foreground">Administrative Audit Trail</h3>
          <p className="text-xs text-muted-foreground">
            Immutable log recording configuration updates, scraper triggers, key management, and
            security events.
          </p>
        </div>

        <select
          aria-label="Filter by action"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs bg-card border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-brand font-medium"
        >
          <option value="all">All Actions</option>
          <option value="trigger_scraper">trigger_scraper</option>
          <option value="update_system_config">update_system_config</option>
          <option value="create_api_key">create_api_key</option>
          <option value="revoke_api_key">revoke_api_key</option>
          <option value="test_notification">test_notification</option>
          <option value="retry_failed_queue_jobs">retry_failed_queue_jobs</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="p-3 font-semibold">Timestamp</th>
                <th className="p-3 font-semibold">Admin User</th>
                <th className="p-3 font-semibold">Action</th>
                <th className="p-3 font-semibold">Target</th>
                <th className="p-3 font-semibold">IP Address</th>
                <th className="p-3 font-semibold">Changes / Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-surface/30 transition">
                    <td className="p-3 font-mono text-muted-foreground">
                      {new Date(l.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="p-3 font-semibold text-foreground">
                      {l.user_email || "system"}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-brand/10 text-brand font-mono">
                        {l.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {l.target_type}:{l.target_id || "all"}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {l.ip_address || "local"}
                    </td>
                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                      {l.changes ? JSON.stringify(l.changes) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================= */
/* HELPERS & SHARED COMPONENTS                                               */
/* ========================================================================= */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    healthy: {
      bg: "bg-emerald-500/10 border-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <CheckCircle2 className="size-3" />,
    },
    completed: {
      bg: "bg-emerald-500/10 border-emerald-500/20",
      text: "text-emerald-600 dark:text-emerald-400",
      icon: <Check className="size-3" />,
    },
    running: {
      bg: "bg-blue-500/10 border-blue-500/20",
      text: "text-blue-600 dark:text-blue-400 animate-pulse",
      icon: <RefreshCcw className="size-3 animate-spin" />,
    },
    retrying: {
      bg: "bg-amber-500/10 border-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      icon: <RotateCcw className="size-3" />,
    },
    degraded: {
      bg: "bg-amber-500/10 border-amber-500/20",
      text: "text-amber-600 dark:text-amber-400",
      icon: <AlertTriangle className="size-3" />,
    },
    blocked: {
      bg: "bg-purple-500/10 border-purple-500/20",
      text: "text-purple-600 dark:text-purple-400",
      icon: <ShieldAlert className="size-3" />,
    },
    failed: {
      bg: "bg-destructive/10 border-destructive/20",
      text: "text-destructive",
      icon: <XCircle className="size-3" />,
    },
    cancelled: {
      bg: "bg-muted border-border",
      text: "text-muted-foreground",
      icon: <XCircle className="size-3" />,
    },
    queued: {
      bg: "bg-muted border-border",
      text: "text-muted-foreground",
      icon: <Clock className="size-3" />,
    },
  };

  const style = map[status] || {
    bg: "bg-muted border-border",
    text: "text-muted-foreground",
    icon: <Activity className="size-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${style.bg} ${style.text}`}
    >
      {style.icon}
      {status}
    </span>
  );
}
