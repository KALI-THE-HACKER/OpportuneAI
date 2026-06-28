import { Link } from "@tanstack/react-router";
import { Bookmark, MapPin, Clock } from "lucide-react";
import type { Job } from "@/lib/mock/jobs";
import { formatSalary, timeAgo } from "@/lib/format";

export function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= 90
      ? "bg-accent/10 text-accent ring-accent/20"
      : score >= 75
      ? "bg-amber-500/10 text-amber-600 ring-amber-500/20 dark:text-amber-400"
      : "bg-muted text-muted-foreground ring-border";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ring-1 ${tone}`}>
      {score}% MATCH
    </span>
  );
}

export function JobCard({
  job,
  onToggleSave,
}: {
  job: Job;
  onToggleSave?: (id: string) => void;
}) {
  return (
    <article className="group p-6 bg-card ring-1 ring-border rounded-lg transition-colors hover:ring-foreground/20">
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-4 min-w-0">
          <div className="size-12 shrink-0 bg-muted rounded-md grid place-items-center text-[10px] font-mono text-muted-foreground ring-1 ring-border">
            {job.company.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              to="/app/jobs/$jobId"
              params={{ jobId: job.id }}
              className="font-medium text-foreground hover:text-accent transition-colors truncate block"
            >
              {job.title}
            </Link>
            <p className="text-sm text-muted-foreground truncate">
              {job.company} • {job.location} • {job.workMode}
            </p>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
              <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {timeAgo(job.postedAt)}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <MatchBadge score={job.matchScore} />
          {onToggleSave && (
            <button
              onClick={() => onToggleSave(job.id)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label={job.saved ? "Unsave" : "Save"}
            >
              <Bookmark className={`size-4 ${job.saved ? "fill-accent text-accent" : ""}`} />
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {job.skills.slice(0, 5).map((s) => (
          <span key={s} className="px-2 py-1 text-[11px] bg-muted text-muted-foreground rounded ring-1 ring-border">
            {s}
          </span>
        ))}
      </div>
      {job.missingSkills.length > 0 && (
        <div className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
          <MapPin className="size-3" /> Missing: {job.missingSkills.join(", ")}
        </div>
      )}
    </article>
  );
}