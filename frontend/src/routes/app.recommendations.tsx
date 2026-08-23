import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { JobCard } from "@/components/shared/job-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { Sparkles, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/recommendations")({
  head: () => ({ meta: [{ title: "AI recommendations · OpportuneAI" }] }),
  component: RecommendationsPage,
});

function RecommendationsPage() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["feed", { limit: 12 }],
    queryFn: () => jobsApi.recommendations(12),
  });

  async function toggleSave(id: string) {
    await jobsApi.toggleSave(id, "recommendation");
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["saved"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <>
      <PageHeader
        title="AI recommendations"
        description="Roles ranked by your profile, skills, and recent market signals."
      />
      {q.isLoading ? (
        <LoadingState variant="job-grid" count={6} />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : q.data!.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-6" />}
          title="No recommendations yet"
          description="Upload your resume to unlock personalized AI-ranked job matches."
          action={
            <Link
              to="/app/resume"
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand text-brand-foreground text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity"
            >
              <Upload className="size-4" />
              Upload resume
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
