import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";
import { Send } from "lucide-react";

export const Route = createFileRoute("/app/applied")({
  head: () => ({ meta: [{ title: "Applications · OpportuneAI" }] }),
  component: AppliedPage,
});

const statusConfig: Record<string, { label: string; className: string }> = {
  applied: {
    label: "Applied",
    className:
      "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20",
  },
  interviewing: {
    label: "Interviewing",
    className:
      "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20",
  },
  offer: {
    label: "Offer",
    className:
      "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-surface text-muted-foreground border border-border",
  },
  saved: {
    label: "Saved",
    className: "bg-surface text-muted-foreground border border-border",
  },
};

function AppliedPage() {
  const q = useQuery({ queryKey: ["applications"], queryFn: () => jobsApi.applications() });

  return (
    <>
      <PageHeader
        title="Applications"
        description="Track every role you've applied to — all in one place."
        actions={
          q.data && q.data.length > 0 ? (
            <span className="text-xs text-muted-foreground font-medium">{q.data.length} total</span>
          ) : undefined
        }
      />
      {q.isLoading ? (
        <LoadingState variant="table" count={5} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          icon={<Send className="size-6" />}
          title="No applications yet"
          description="Apply to jobs to start tracking your progress here."
        />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface/70 border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest">
                    Role
                  </th>
                  <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest">
                    Company
                  </th>
                  <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest hidden md:table-cell">
                    Applied
                  </th>
                  <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-5 py-3.5 font-semibold text-[11px] uppercase tracking-widest text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data!.map((a) => {
                  const status = statusConfig[a.status] ?? statusConfig["applied"];
                  return (
                    <tr key={a.id} className="hover:bg-surface/40 transition-colors duration-100">
                      <td className="px-5 py-4 font-semibold text-foreground">{a.job.title}</td>
                      <td className="px-5 py-4 text-muted-foreground">{a.job.company}</td>
                      <td className="px-5 py-4 text-muted-foreground text-xs hidden md:table-cell">
                        {timeAgo(a.appliedAt)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to="/app/jobs/$jobId"
                          params={{ jobId: a.jobId }}
                          className="text-xs font-semibold text-foreground hover:text-accent transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
