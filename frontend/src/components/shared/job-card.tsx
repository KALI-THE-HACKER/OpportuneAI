import { Link } from "@tanstack/react-router";
import { Bookmark, MapPin, Clock, ArrowUpRight } from "lucide-react";
import type { JobWithDbId } from "@/lib/api";
import { recordEvent } from "@/lib/api";
import { formatSalary, timeAgo } from "@/lib/format";

export function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20"
      : score >= 75
        ? "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
        : "bg-surface text-muted-foreground ring-border";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ring-1 ${tone}`}
    >
      {score}%
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
  onToggleSave?: (id: string) => void;
  /** Zero-based position in the list, used for event context. */
  position?: number;
  source?: "feed" | "search" | "recommendation";
}) {
  function fireClick() {
    if (job.dbId == null) return;
    void recordEvent({
      jobId: job.dbId,
      eventType: "click",
      source,
      position,
    });
  }

  function fireSave() {
    if (job.dbId == null || !onToggleSave) return;
    onToggleSave(job.id);
    void recordEvent({
      jobId: job.dbId,
      eventType: job.saved ? "unsave" : "save",
      source,
      position,
    });
  }

  return (
    <article
      className="
      group p-5 bg-card border border-border rounded-xl shadow-card
      hover:shadow-elevated hover:border-border/80
      transition-all duration-200 relative
    "
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-3.5 min-w-0 flex-1">
          <CompanyAvatar company={job.company} />
          <div className="min-w-0 flex-1">
            <Link
              to="/app/jobs/$jobId"
              params={{ jobId: job.id }}
              onClick={fireClick}
              className="font-semibold text-foreground hover:text-accent transition-colors duration-150 truncate block text-sm leading-tight"
            >
              {job.title}
            </Link>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {job.company} · {job.location} · <span className="capitalize">{job.workMode}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-3">
              <span className="font-medium text-foreground/70">
                {formatSalary(job.salaryMin, job.salaryMax)}
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="size-3" />
                {timeAgo(job.postedAt)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <MatchBadge score={job.matchScore} />
          {onToggleSave && (
            <button
              onClick={fireSave}
              className="text-muted-foreground hover:text-foreground transition-colors duration-150 cursor-pointer"
              aria-label={job.saved ? "Unsave job" : "Save job"}
            >
              <Bookmark
                className={`size-4 transition-all duration-200 ${
                  job.saved ? "fill-accent text-accent" : ""
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Skill tags */}
      {job.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
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
        <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-3 text-amber-500" />
          <span>Missing: </span>
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {job.missingSkills.slice(0, 3).join(", ")}
            {job.missingSkills.length > 3 && ` +${job.missingSkills.length - 3}`}
          </span>
        </div>
      )}

      {/* View link — appears on hover */}
      <Link
        to="/app/jobs/$jobId"
        params={{ jobId: job.id }}
        onClick={fireClick}
        className="absolute bottom-4 right-4 size-7 grid place-items-center rounded-lg border border-border bg-surface text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:text-foreground hover:bg-card shadow-sm"
        aria-label="Open job details"
      >
        <ArrowUpRight className="size-3.5" />
      </Link>
    </article>
  );
}
