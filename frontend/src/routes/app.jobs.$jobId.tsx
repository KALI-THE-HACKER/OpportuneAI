import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  ArrowLeft,
  Bookmark,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Clock,
  Briefcase,
  DollarSign,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { jobsApi, recordEvent } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";
import { MatchBadge } from "@/components/shared/job-card";
import { formatSalary, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/app/jobs/$jobId")({
  head: () => ({ meta: [{ title: "Job details · OpportuneAI" }] }),
  component: JobDetailPage,
});

function JobDetailPage() {
  const { jobId } = useParams({ from: "/app/jobs/$jobId" });
  const qc = useQueryClient();
  const viewedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  const q = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
  });

  // Record 'view' event once on load with duration on unmount
  useEffect(() => {
    if (!q.data?.dbId || viewedRef.current) return;
    viewedRef.current = true;
    startTimeRef.current = Date.now();

    void recordEvent({
      jobId: q.data.dbId,
      eventType: "view",
      source: "job_detail",
    });

    return () => {
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (q.data?.dbId && durationSeconds > 0) {
        void recordEvent({
          jobId: q.data.dbId,
          eventType: "view",
          source: "job_detail",
          metadata: { duration_seconds: durationSeconds },
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.dbId]);

  const apply = useMutation({
    mutationFn: () => jobsApi.apply(jobId, "job_detail"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
  });

  const save = useMutation({
    mutationFn: () => jobsApi.toggleSave(jobId, "job_detail"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job", jobId] });
      qc.invalidateQueries({ queryKey: ["saved"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
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
          <Link to="/app/jobs" className="text-foreground underline text-sm">
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
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to explorer
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main article */}
        <article>
          <header className="mb-7 pb-7 border-b border-border">
            <div className="flex items-start gap-4">
              {/* Company avatar */}
              <div className="size-14 shrink-0 rounded-xl bg-surface border border-border grid place-items-center font-mono text-sm font-bold text-muted-foreground shadow-sm">
                {job.company.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold text-foreground tracking-tight leading-tight">
                  {job.title}
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {job.company} · {job.location} · {job.workMode} · {job.type}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <DollarSign className="size-3" />
                    {formatSalary(job.salaryMin, job.salaryMax)}
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    Posted {timeAgo(job.postedAt)}
                  </span>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Briefcase className="size-3" />
                    {job.experienceLevel}
                  </span>
                </div>
              </div>
            </div>
          </header>

          <Section title="About the role">
            <p className="text-sm text-foreground/90 leading-relaxed">{job.description}</p>
          </Section>

          <Section title="Responsibilities">
            <ul className="space-y-2 text-sm text-foreground/85">
              {job.responsibilities.map((r) => (
                <li key={r} className="flex gap-2.5 leading-relaxed">
                  <span className="text-accent mt-1 shrink-0">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Requirements">
            <ul className="space-y-2 text-sm text-foreground/85">
              {job.requirements.map((r) => (
                <li key={r} className="flex gap-2.5 leading-relaxed">
                  <span className="text-accent mt-1 shrink-0">·</span>
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
                  className="px-2.5 py-1 text-[11px] font-medium bg-surface text-muted-foreground rounded-full border border-border"
                >
                  {s}
                </span>
              ))}
            </div>
          </Section>
        </article>

        {/* Sticky sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-20 self-start">
          {/* CTA card */}
          <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <MatchBadge score={job.matchScore} />
              <span className="text-xs text-muted-foreground font-medium">
                {job.experienceLevel}
              </span>
            </div>

            <button
              onClick={() => apply.mutate()}
              disabled={apply.isPending || apply.isSuccess}
              className="
                w-full h-10 inline-flex items-center justify-center gap-2
                rounded-lg bg-brand text-brand-foreground text-sm font-semibold
                border border-brand/80 hover:opacity-90
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-150 shadow-sm cursor-pointer
              "
            >
              {apply.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Applying…
                </>
              ) : apply.isSuccess ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Application sent
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Apply now
                </>
              )}
            </button>

            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="
                w-full h-10 inline-flex items-center justify-center gap-2
                rounded-lg border border-border bg-surface text-sm font-medium
                hover:bg-card hover:border-foreground/20 shadow-sm
                disabled:opacity-60 disabled:cursor-not-allowed
                transition-all duration-150 cursor-pointer
              "
            >
              {save.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin text-accent" />
                  Saving…
                </>
              ) : (
                <>
                  <Bookmark
                    className={`size-4 transition-all duration-200 ${job.saved ? "fill-accent text-accent" : ""}`}
                  />
                  {job.saved ? "Saved" : "Save for later"}
                </>
              )}
            </button>
          </div>

          {/* AI Insight card */}
          <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
            <div className="flex items-center gap-2">
              <div className="size-7 grid place-items-center rounded-lg bg-accent/10 border border-accent/20">
                <Sparkles className="size-3.5 text-accent" />
              </div>
              <h3 className="text-sm font-semibold">AI insight</h3>
            </div>

            {job.aiExplanation && (
              <p className="text-sm text-foreground/85 leading-relaxed">{job.aiExplanation}</p>
            )}

            {/* Matched skills */}
            {job.matchedSkills.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Matched skills
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {job.matchedSkills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Missing skills */}
            {job.missingSkills.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="size-3 text-amber-500" />
                  Skill gaps
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {job.missingSkills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
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
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}
