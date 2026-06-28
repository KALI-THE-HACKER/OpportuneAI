import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { JobCard } from "@/components/shared/job-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";

export const Route = createFileRoute("/app/recommendations")({
  head: () => ({ meta: [{ title: "AI recommendations · OpportuneAI" }] }),
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["recommendations", "all"], queryFn: () => jobsApi.recommendations(12) });

  async function toggleSave(id: string) {
    await jobsApi.toggleSave(id);
    qc.invalidateQueries({ queryKey: ["recommendations"] });
    qc.invalidateQueries({ queryKey: ["saved"] });
  }

  return (
    <>
      <PageHeader title="AI recommendations" description="Roles ranked by your profile, skills, and recent signals." />
      {q.isLoading ? <LoadingState /> :
        q.isError ? <ErrorState onRetry={() => q.refetch()} /> :
        q.data!.length === 0 ? <EmptyState title="No recommendations yet" description="Upload a resume to get personalized matches." /> :
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {q.data!.map((j) => <JobCard key={j.id} job={j} onToggleSave={toggleSave} />)}
        </div>
      }
    </>
  );
}