import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { JobCard } from "@/components/shared/job-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/app/saved")({
  head: () => ({ meta: [{ title: "Saved jobs · OpportuneAI" }] }),
  component: SavedPage,
});

function SavedPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved"], queryFn: () => jobsApi.saved() });
  async function toggleSave(id: string) {
    await jobsApi.toggleSave(id);
    qc.invalidateQueries({ queryKey: ["saved"] });
  }
  return (
    <>
      <PageHeader title="Saved jobs" description="Roles you've bookmarked to review later." />
      {q.isLoading ? (
        <LoadingState />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-5" />}
          title="Nothing saved yet"
          description="Tap the bookmark on any job to keep it here."
          action={
            <Link
              to="/app/jobs"
              className="h-9 px-4 inline-flex items-center rounded-md bg-brand text-brand-foreground text-sm"
            >
              Browse jobs
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {q.data!.map((j) => (
            <JobCard key={j.id} job={j} onToggleSave={toggleSave} />
          ))}
        </div>
      )}
    </>
  );
}
