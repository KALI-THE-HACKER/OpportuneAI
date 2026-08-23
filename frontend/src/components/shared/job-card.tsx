import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bookmark, MapPin, Clock, Calendar, ArrowUpRight, Loader2 } from "lucide-react";
import type { JobWithDbId } from "@/lib/api";
import { recordEvent } from "@/lib/api";
import { formatSalary, timeAgo, formatApplyDeadline } from "@/lib/format";

export function MatchBadge({ score }: { score?: number }) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score ?? 0)));
  const tone =
    safeScore >= 90
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
      : safeScore >= 75
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
        : "bg-surface text-muted-foreground ring-border";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ring-1 ${tone}`}
    >
      {safeScore}%
    </span>
  );
}

function CompanyAvatar({ company }: { company: string }) {
  const initials = company.slice(0, 2).toUpperCase();
  return (
    <div className="size-11 shrink-0 bg-surface border border-border rounded-xl grid place-items-center font-mono text-[11px] font-semibold text-muted-foreground shadow-sm">
      {initials}
    </div>
  );
}

export function JobCard({
  job,
  onToggleSave,
  position,
  source = "feed",
}: {
  job: JobWithDbId;
  onToggleSave?: (id: string) => Promise<void> | void;
  /** Zero-based position in the list, used for event context. */
  position?: number;
  source?: "feed" | "search" | "recommendation";
}) {
  const [isSaving, setIsSaving] = useState(false);

  function fireClick() {
    if (job.dbId == null) return;
    void recordEvent({
      jobId: job.dbId,
      eventType: "click",
      source,
      position,
    });
  }

  async function fireSave() {
    if (!onToggleSave || isSaving) return;
    setIsSaving(true);
    try {
      await onToggleSave(job.id);
    } finally {
      setIsSaving(false);
    }
  }

  const deadlineText = formatApplyDeadline(job.lastDateToApply);
  const isExpiringSoon = job.lastDateToApply
    ? new Date(job.lastDateToApply).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
      new Date(job.lastDateToApply).getTime() > Date.now()
    : false;

  return (
    <article
      className="
      group p-5 bg-card border border-border rounded-xl shadow-card
      hover:shadow-elevated hover:border-accent/40 dark:hover:border-accent/30
      transition-all duration-200 relative cursor-pointer
    "
    >
      {/* Stretched link covering entire tile for primary navigation */}
      <Link
        to="/app/jobs/$jobId"
        params={{ jobId: job.id }}
        onClick={fireClick}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label={`View details for ${job.title} at ${job.company}`}
      />

      <div className="relative z-10 flex justify-between items-start gap-4 pointer-events-none">
        <div className="flex gap-3.5 min-w-0 flex-1">
          <CompanyAvatar company={job.company} />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors duration-150 truncate text-sm leading-tight">
              {job.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {job.company} · {job.location} · <span className="capitalize">{job.workMode}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-medium text-foreground/70">
                {formatSalary(job.salaryMin, job.salaryMax)}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                {timeAgo(job.postedAt)}
              </span>
              {deadlineText && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    isExpiringSoon
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  <Calendar className="size-3" />
                  {deadlineText}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0 pointer-events-auto">
          <MatchBadge score={job.matchScore} />
          {onToggleSave && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                void fireSave();
              }}
              disabled={isSaving}
              className="p-1 -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface transition-colors duration-150 cursor-pointer disabled:opacity-60"
              aria-label={job.saved ? "Unsave job" : "Save job"}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin text-accent" />
              ) : (
                <Bookmark
                  className={`size-4 transition-all duration-200 ${
                    job.saved ? "fill-accent text-accent" : ""
                  }`}
                />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Skill tags */}
      {job.skills.length > 0 && (
        <div className="relative z-10 mt-4 flex flex-wrap gap-1.5 pointer-events-none">
          {job.skills.slice(0, 5).map((s) => (
            <span
              key={s}
              className="px-2.5 py-0.5 text-[11px] font-medium bg-surface text-muted-foreground rounded-full border border-border"
            >
              {s}
            </span>
          ))}
          {job.skills.length > 5 && (
            <span className="px-2.5 py-0.5 text-[11px] font-medium bg-surface text-muted-foreground rounded-full border border-border">
              +{job.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Missing skills warning */}
      {job.missingSkills.length > 0 && (
        <div className="relative z-10 mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5 pointer-events-none">
          <MapPin className="size-3 text-amber-500" />
          <span>Missing: </span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {job.missingSkills.slice(0, 3).join(", ")}
            {job.missingSkills.length > 3 && ` +${job.missingSkills.length - 3}`}
          </span>
        </div>
      )}

      {/* View arrow indicator — subtle feedback on hover */}
      <div
        className="absolute bottom-4 right-4 size-7 grid place-items-center rounded-lg border border-border bg-surface text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 group-hover:text-foreground group-hover:bg-card shadow-sm pointer-events-none z-10"
        aria-hidden="true"
      >
        <ArrowUpRight className="size-3.5" />
      </div>
    </article>
  );
}
