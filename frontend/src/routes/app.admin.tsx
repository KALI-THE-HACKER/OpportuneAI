import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingState, ErrorState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/admin")({
  head: () => ({ meta: [{ title: "Admin · OpportuneAI" }] }),
  component: AdminPage,
});

const statusTone: Record<string, string> = {
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  degraded: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  idle: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  down: "bg-destructive/10 text-destructive ring-destructive/20",
  offline: "bg-destructive/10 text-destructive ring-destructive/20",
  queued: "bg-muted text-muted-foreground ring-border",
  processing: "bg-accent/10 text-accent ring-accent/20",
  failed: "bg-destructive/10 text-destructive ring-destructive/20",
};

function AdminPage() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: () => adminApi.stats() });
  const providers = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => adminApi.providers(),
  });
  const workers = useQuery({ queryKey: ["admin-workers"], queryFn: () => adminApi.workers() });
  const queue = useQuery({ queryKey: ["admin-queue"], queryFn: () => adminApi.queue() });

  const isLoading = stats.isLoading || providers.isLoading || workers.isLoading || queue.isLoading;
  const isError = stats.isError || providers.isError || workers.isError || queue.isError;

  return (
    <>
      <PageHeader
        title="System & ingestion"
        description="Pipeline status, providers, workers, and the live queue."
      />

      {isLoading ? (
        <div className="space-y-8">
          <LoadingState variant="stats" count={4} />
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded w-20 animate-pulse" />
            <LoadingState variant="table" count={3} />
          </div>
        </div>
      ) : isError ? (
        <ErrorState
          onRetry={() => {
            stats.refetch();
            providers.refetch();
            workers.refetch();
            queue.refetch();
          }}
        />
      ) : (
        <div className="space-y-8">
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total jobs" value={stats.data!.totalJobs.toLocaleString()} />
            <StatCard label="Total users" value={stats.data!.totalUsers.toLocaleString()} />
            <StatCard label="Jobs · 24h" value={stats.data!.jobsLast24h.toLocaleString()} />
            <StatCard
              label="Uptime"
              value={`${stats.data!.uptimePct}%`}
              progress={stats.data!.uptimePct}
            />
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Providers
            </h2>
            <div className="bg-card ring-1 ring-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Provider</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Jobs today</th>
                    <th className="px-4 py-3 text-left font-medium">Success rate</th>
                    <th className="px-4 py-3 text-left font-medium">Last sync</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {providers.data!.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ring-1 ${statusTone[p.status]}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.jobsToday.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.successRate}%</td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(p.lastSyncAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Worker nodes
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {workers.data!.map((w) => (
                <div key={w.id} className="p-4 bg-card ring-1 ring-border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs">{w.id}</span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded ring-1 ${statusTone[w.status]}`}
                    >
                      {w.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-3">{w.region}</div>
                  <Bar label="CPU" value={w.cpu} />
                  <Bar label="Memory" value={w.memory} />
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {w.jobsProcessed.toLocaleString()} jobs
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Live queue
            </h2>
            <div className="bg-card ring-1 ring-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">ID</th>
                    <th className="px-4 py-3 text-left font-medium">Provider</th>
                    <th className="px-4 py-3 text-left font-medium">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Attempts</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Enqueued</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {queue.data!.map((q) => (
                    <tr key={q.id}>
                      <td className="px-4 py-3 font-mono text-xs">{q.id}</td>
                      <td className="px-4 py-3">{q.provider}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.type}</td>
                      <td className="px-4 py-3 text-muted-foreground">{q.attempts}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded ring-1 ${statusTone[q.status]}`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{timeAgo(q.enqueuedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${value > 80 ? "bg-destructive" : value > 60 ? "bg-amber-500" : "bg-accent"}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
