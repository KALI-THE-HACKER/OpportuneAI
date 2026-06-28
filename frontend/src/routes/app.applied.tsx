import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/applied")({
  head: () => ({ meta: [{ title: "Applications · OpportuneAI" }] }),
  component: AppliedPage,
});

const statusTone: Record<string, string> = {
  applied: "bg-accent/10 text-accent ring-accent/20",
  interviewing: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
  offer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20",
  rejected: "bg-muted text-muted-foreground ring-border",
  saved: "bg-muted text-muted-foreground ring-border",
};

function AppliedPage() {
  const q = useQuery({ queryKey: ["applications"], queryFn: () => jobsApi.applications() });

  return (
    <>
      <PageHeader
        title="Applications"
        description="Track every role you've applied to in one place."
      />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Apply to a job to start tracking here."
        />
      ) : (
        <div className="bg-card ring-1 ring-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium text-xs uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 font-medium text-xs uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-3 font-medium text-xs uppercase tracking-wider">
                    Applied
                  </th>
                  <th className="px-6 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 font-medium text-xs uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {q.data!.map((a) => (
                  <tr key={a.id} className="hover:bg-surface/50">
                    <td className="px-6 py-4 font-medium text-foreground">{a.job.title}</td>
                    <td className="px-6 py-4 text-muted-foreground">{a.job.company}</td>
                    <td className="px-6 py-4 text-muted-foreground">{timeAgo(a.appliedAt)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded ring-1 ${statusTone[a.status]}`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to="/app/jobs/$jobId"
                        params={{ jobId: a.jobId }}
                        className="text-foreground hover:text-accent text-sm"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
