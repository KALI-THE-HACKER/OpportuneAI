import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
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
  Mail,
  Copy,
  Check,
  User,
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
  const navigate = useNavigate();
  const qc = useQueryClient();
  const viewedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  function handleGoBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      navigate({ to: "/app/jobs" });
    }
  }

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
      // Optimistically update current job state to applied
      qc.setQueryData(["job", jobId], (old: typeof q.data) => (old ? { ...old, applied: true } : old));

      // Optimistically filter applied job from cached feed / recommendations in memory
      qc.setQueriesData({ queryKey: ["feed"] }, (old: any) => {
        if (!old) return old;
        if (Array.isArray(old)) {
          return old.filter((j: any) => j.id !== jobId && j.id !== `job-${jobId}`);
        }
        if (old.items && Array.isArray(old.items)) {
          return {
            ...old,
            items: old.items.filter((j: any) => j.id !== jobId && j.id !== `job-${jobId}`),
            total: Math.max(0, (old.total ?? old.items.length) - 1),
          };
        }
        return old;
      });

      // Update applications & notifications lists
      qc.invalidateQueries({ queryKey: ["applications"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
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
          <button
            type="button"
            onClick={handleGoBack}
            className="text-foreground underline text-sm cursor-pointer"
          >
            Go back
          </button>
        }
      />
    );

  const job = q.data;

  return (
    <>
      <button
        type="button"
        onClick={handleGoBack}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="size-4" />
        Go back
      </button>

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

            {/* Primary CTA: direct apply link > mailto contact > tracked apply button */}
            {job.applied || apply.isSuccess ? (
              job.applyUrl ? (
                <a
                  id="btn-apply-direct"
                  href={job.applyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    w-full h-10 inline-flex items-center justify-center gap-2
                    rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 text-sm font-semibold
                    hover:bg-emerald-100/70 dark:hover:bg-emerald-500/15
                    transition-all duration-150 shadow-sm cursor-pointer
                  "
                >
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Applied
                  <ExternalLink className="size-3.5 opacity-60 ml-0.5" />
                </a>
              ) : (
                <button
                  id="btn-apply-tracked"
                  disabled
                  className="
                    w-full h-10 inline-flex items-center justify-center gap-2
                    rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20 text-sm font-semibold
                    transition-all duration-150 shadow-sm cursor-default
                  "
                >
                  <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                  Applied
                </button>
              )
            ) : job.applyUrl ? (
              <a
                id="btn-apply-direct"
                href={job.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => apply.mutate()}
                className="
                  w-full h-10 inline-flex items-center justify-center gap-2
                  rounded-lg bg-brand text-brand-foreground text-sm font-semibold
                  border border-brand/80 hover:opacity-90
                  transition-all duration-150 shadow-sm cursor-pointer
                "
              >
                <ExternalLink className="size-4" />
                Apply now
              </a>
            ) : job.contactEmail ? (
              <ContactOutreach job={job} />
            ) : (
              <button
                id="btn-apply-tracked"
                onClick={() => apply.mutate()}
                disabled={apply.isPending}
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
                ) : (
                  <>
                    <Send className="size-4" />
                    Apply now
                  </>
                )}
              </button>
            )}


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

/** Shown when applyUrl is absent but contactEmail was discovered by the AI agent. */
function ContactOutreach({ job }: { job: import("@/lib/mock/jobs").Job }) {
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSubject, setGeneratedSubject] = useState<string | null>(null);
  const [generatedBody, setGeneratedBody] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const defaultSubject = `Application for ${job.title} at ${job.company}`;
  const defaultBody =
    `Hi ${job.contactName ?? "there"},\n\n` +
    `I came across the ${job.title} opening at ${job.company} and I'm excited to apply.\n\n` +
    `I believe my background aligns well with the role and I'd love the opportunity to connect.\n\n` +
    `Looking forward to hearing from you.\n\nBest regards`;

  const activeSubject = generatedSubject ?? defaultSubject;
  const activeBody = generatedBody ?? defaultBody;

  const mailtoHref = `mailto:${job.contactEmail}?subject=${encodeURIComponent(activeSubject)}&body=${encodeURIComponent(activeBody)}`;

  async function handleGenerateEmail() {
    setIsGenerating(true);
    try {
      const res = await jobsApi.generateOutreach(
        job.id,
        job.contactName,
        job.contactRole,
      );
      setGeneratedSubject(res.subject);
      setGeneratedBody(res.body);
      setShowModal(true);
    } catch {
      // If AI fails, still allow manual preview
      setShowModal(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function copyEmail() {
    if (!job.contactEmail) return;
    void navigator.clipboard.writeText(job.contactEmail).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyFullDraft() {
    const draftText = `Subject: ${activeSubject}\n\n${activeBody}`;
    void navigator.clipboard.writeText(draftText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-2.5">
      {/* Primary Mailto Action */}
      <a
        id="btn-contact-email"
        href={mailtoHref}
        className="
          w-full h-10 inline-flex items-center justify-center gap-2
          rounded-lg bg-brand text-brand-foreground text-sm font-semibold
          border border-brand/80 hover:opacity-90
          transition-all duration-150 shadow-sm cursor-pointer
        "
      >
        <Mail className="size-4" />
        Email {job.contactRole ? job.contactRole : "Recruiter"}
      </a>

      {/* AI Generate Personalized Pitch Button */}
      <button
        id="btn-generate-outreach"
        type="button"
        onClick={handleGenerateEmail}
        disabled={isGenerating}
        className="
          w-full h-9 inline-flex items-center justify-center gap-2
          rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-semibold
          border border-accent/30 transition-all duration-150 cursor-pointer disabled:opacity-50
        "
      >
        {isGenerating ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            Crafting tailored pitch...
          </>
        ) : (
          <>
            <Sparkles className="size-3.5" />
            Generate tailored email with AI
          </>
        )}
      </button>

      {/* Contact Card */}
      <div className="p-3 bg-surface border border-border rounded-lg flex items-start gap-2.5">
        <div className="size-7 shrink-0 grid place-items-center rounded-full bg-accent/10 border border-accent/20 mt-0.5">
          <User className="size-3.5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          {job.contactName && (
            <p className="text-xs font-semibold text-foreground truncate">{job.contactName}</p>
          )}
          {job.contactRole && (
            <p className="text-[11px] text-muted-foreground truncate">{job.contactRole}</p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            <p className="text-[11px] text-foreground/70 truncate flex-1">{job.contactEmail}</p>
            <button
              id="btn-copy-email"
              type="button"
              onClick={copyEmail}
              className="shrink-0 p-0.5 rounded hover:bg-accent/10 transition-colors cursor-pointer"
              title="Copy email"
            >
              {copied ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Contact discovered by AI · verify before reaching out
      </p>

      {/* Generated Email Preview Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-surface border border-border rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">
                  Personalized Outreach Draft
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={activeSubject}
                  onChange={(e) => setGeneratedSubject(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:border-accent"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                  Message Body
                </label>
                <textarea
                  rows={7}
                  value={activeBody}
                  onChange={(e) => setGeneratedBody(e.target.value)}
                  className="w-full p-3 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-hidden focus:border-accent resize-none leading-relaxed font-sans"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={copyFullDraft}
                className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-xs font-semibold border border-border rounded-lg hover:bg-accent/10 text-foreground transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5 text-muted-foreground" />
                    Copy Draft
                  </>
                )}
              </button>

              <a
                href={mailtoHref}
                onClick={() => setShowModal(false)}
                className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-brand text-brand-foreground rounded-lg hover:opacity-90 transition-all cursor-pointer"
              >
                <Send className="size-3.5" />
                Open Email Client
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

