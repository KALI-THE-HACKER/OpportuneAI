import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { JobCard } from "@/components/shared/job-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { Bookmark, Search } from "lucide-react";

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
      <PageHeader
        title="Saved jobs"
        description="Roles you've bookmarked to review and apply to later."
        actions={
          q.data && q.data.length > 0 ? (
            <span className="text-xs text-muted-foreground font-medium">{q.data.length} saved</span>
          ) : undefined
        }
      />
      {q.isLoading ? (
        <LoadingState variant="job-grid" count={4} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="size-6" />}
          title="Nothing saved yet"
          description="Tap the bookmark icon on any job to keep it here for later review."
          action={
            <Link
              to="/app/jobs"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-brand-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Search className="size-4" />
              Browse jobs
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {q.data!.map((j) => (
            <JobCard key={j.id} job={j} onToggleSave={toggleSave} />
          ))}
        </div>
      )}
    </>
  );
}
