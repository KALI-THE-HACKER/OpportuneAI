import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bookmark, Send, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { jobsApi } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { MatchBadge } from "@/components/shared/job-card";
import { formatSalary, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/jobs/$jobId")({
  head: () => ({ meta: [{ title: "Job details · OpportuneAI" }] }),
  component: JobDetailsPage,
});

function JobDetailsPage() {
  const { jobId } = useParams({ from: "/app/jobs/$jobId" });
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["job", jobId], queryFn: () => jobsApi.get(jobId) });

  const apply = useMutation({
    mutationFn: () => jobsApi.apply(jobId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });
  const save = useMutation({
    mutationFn: () => jobsApi.toggleSave(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["saved"] });
    },
  });

  if (q.isLoading) return <LoadingState variant="job-detail" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  if (!q.data)
    return (
      <EmptyState
        title="Job not found"
        description="This listing may have been removed."
        action={
          <Link to="/app/jobs" className="text-foreground underline">
            Back to explorer
          </Link>
        }
      />
    );

  const job = q.data;

  return (
    <>
      <Link
        to="/app/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="size-4" /> Back to explorer
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <article>
          <header className="mb-6">
            <div className="flex items-start gap-4">
              <div className="size-14 shrink-0 rounded-md bg-muted grid place-items-center font-mono text-xs text-muted-foreground ring-1 ring-border">
                {job.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold text-foreground">{job.title}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {job.company} · {job.location} · {job.workMode} · {job.type}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatSalary(job.salaryMin, job.salaryMax)} · Posted {timeAgo(job.postedAt)}
                </p>
              </div>
            </div>
          </header>

          <Section title="About the role">
            <p className="text-sm text-foreground/90 leading-relaxed">{job.description}</p>
          </Section>
          <Section title="Responsibilities">
            <ul className="space-y-2 text-sm text-foreground/90">
              {job.responsibilities.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-accent">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Requirements">
            <ul className="space-y-2 text-sm text-foreground/90">
              {job.requirements.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="text-accent">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s) => (
                <span
                  key={s}
                  className="px-2 py-1 text-[11px] bg-muted text-muted-foreground rounded ring-1 ring-border"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          <div className="p-6 bg-card ring-1 ring-border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <MatchBadge score={job.matchScore} />
              <span className="text-xs text-muted-foreground">{job.experienceLevel}</span>
            </div>
            <button
              onClick={() => apply.mutate()}
              disabled={apply.isPending || apply.isSuccess}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md bg-brand text-brand-foreground text-sm font-medium ring-1 ring-brand hover:bg-brand/90 disabled:opacity-60"
            >
              {apply.isSuccess ? (
                <>
                  <CheckCircle2 className="size-4" /> Application sent
                </>
              ) : (
                <>
                  <Send className="size-4" /> Apply now
                </>
              )}
            </button>
            <button
              onClick={() => save.mutate()}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-md ring-1 ring-border text-sm font-medium hover:bg-surface"
            >
              <Bookmark className={`size-4 ${job.saved ? "fill-accent text-accent" : ""}`} />
              {job.saved ? "Saved" : "Save for later"}
            </button>
          </div>

          <div className="p-6 bg-card ring-1 ring-border rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="size-4 text-accent" />
              <h3 className="text-sm font-semibold">AI insight</h3>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{job.aiExplanation}</p>

            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
                Matched skills
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.matchedSkills.map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-accent/10 text-accent ring-1 ring-accent/20"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
            {job.missingSkills.length > 0 && (
              <div className="mt-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="size-3 text-amber-500" /> Missing skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {job.missingSkills.map((s) => (
                    <span
                      key={s}
                      className="px-1.5 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}
