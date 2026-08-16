import { Loader2, AlertCircle, Inbox, RefreshCcw } from "lucide-react";
import type { ReactNode } from "react";

export type LoadingVariant =
  | "spinner"
  | "job-card"
  | "job-list"
  | "job-grid"
  | "table"
  | "job-detail"
  | "profile"
  | "resume"
  | "stats";

/* ──────────────────────────────────────────────────────────────
   Shared shimmer block helper
────────────────────────────────────────────────────────────── */
function Sh({ className = "" }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className}`} />;
}

/* ──────────────────────────────────────────────────────────────
   Job Card Skeleton
────────────────────────────────────────────────────────────── */
function JobCardSkeleton() {
  return (
    <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-3.5 min-w-0 flex-1">
          {/* Company Avatar */}
          <Sh className="size-12 rounded-lg shrink-0" />
          <div className="flex-grow space-y-2">
            <Sh className="h-4 w-2/5" />
            <Sh className="h-3 w-3/5" />
            <Sh className="h-3 w-1/4 mt-1" />
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Sh className="h-5 w-20 rounded-full" />
          <Sh className="size-4 rounded-full" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {[14, 18, 12, 22, 16].map((w, i) => (
          <Sh key={i} className={`h-5 w-${w} rounded-full`} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Table Skeleton
────────────────────────────────────────────────────────────── */
function TableSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="bg-surface/70 h-11 border-b border-border flex items-center px-5 gap-6">
        {[90, 70, 55, 55].map((w, i) => (
          <Sh key={i} className={`h-3 rounded w-${w}`} style={{ width: `${w}px` }} />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="h-14 flex items-center px-5 gap-6">
            <Sh className="h-4 rounded flex-1 max-w-[160px]" />
            <Sh className="h-4 rounded flex-1 max-w-[110px]" />
            <Sh className="h-4 rounded flex-1 max-w-[80px]" />
            <Sh className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Job Detail Skeleton
────────────────────────────────────────────────────────────── */
function JobDetailSkeleton() {
  return (
    <div className="space-y-6 w-full">
      {/* Breadcrumb */}
      <Sh className="h-4 w-32" />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Left — Article */}
        <div className="space-y-6">
          <header className="flex gap-4">
            <Sh className="size-14 rounded-xl shrink-0" />
            <div className="space-y-2.5 flex-grow">
              <Sh className="h-7 w-1/2" />
              <Sh className="h-4 w-2/3" />
              <Sh className="h-3 w-1/3" />
            </div>
          </header>

          {["About the role", "Responsibilities", "Requirements"].map((_, i) => (
            <div key={i} className="space-y-3">
              <Sh className="h-3 w-28" />
              <div className="space-y-2">
                <Sh className="h-4 w-full" />
                <Sh className="h-4 w-11/12" />
                <Sh className="h-4 w-4/5" />
                {i === 0 && <Sh className="h-4 w-full" />}
              </div>
            </div>
          ))}

          <div className="space-y-3">
            <Sh className="h-3 w-16" />
            <div className="flex flex-wrap gap-2">
              {[60, 80, 50, 90, 70, 65].map((w, i) => (
                <Sh key={i} className="h-6 rounded-full" style={{ width: `${w}px` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Right — Sidebar */}
        <div className="space-y-4">
          <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <Sh className="h-5 w-20 rounded-full" />
              <Sh className="h-4 w-16" />
            </div>
            <Sh className="h-10 w-full rounded-lg" />
            <Sh className="h-10 w-full rounded-lg" />
          </div>

          <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
            <div className="flex items-center gap-2">
              <Sh className="size-4" />
              <Sh className="h-4 w-20" />
            </div>
            <div className="space-y-2">
              <Sh className="h-3 w-full" />
              <Sh className="h-3 w-5/6" />
              <Sh className="h-3 w-11/12" />
            </div>
            <div className="space-y-2">
              <Sh className="h-3 w-24" />
              <div className="flex flex-wrap gap-1.5">
                {[50, 65, 45, 70].map((w, i) => (
                  <Sh key={i} className="h-5 rounded-full" style={{ width: `${w}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Profile Skeleton
────────────────────────────────────────────────────────────── */
function ProfileSkeleton() {
  return (
    <div className="space-y-5 max-w-2xl w-full">
      {[
        { fields: 3, title: 28 },
        { fields: 4, title: 36 },
      ].map((card, c) => (
        <div key={c} className="bg-card border border-border rounded-xl p-6 shadow-card space-y-5">
          <Sh className="h-3 rounded" style={{ width: `${card.title}px` }} />
          <div className="space-y-4">
            {Array.from({ length: card.fields }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Sh className="h-3 w-20" />
                <Sh className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Resume Skeleton
────────────────────────────────────────────────────────────── */
function ResumeSkeleton() {
  return (
    <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4 w-full">
      <div className="flex items-center gap-3">
        <Sh className="size-10 rounded-lg shrink-0" />
        <div className="space-y-2 flex-grow">
          <Sh className="h-4 w-3/4" />
          <Sh className="h-3 w-1/2" />
        </div>
        <Sh className="size-8 rounded-md shrink-0" />
      </div>
      <Sh className="h-10 w-full rounded-lg" />
      <div className="space-y-2.5 py-3 border-t border-border">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Sh className="h-3 w-24" />
            <Sh className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Sh className="h-3 w-20" />
        <div className="flex flex-wrap gap-1.5">
          {[55, 45, 70, 50, 65, 42].map((w, i) => (
            <Sh key={i} className="h-5 rounded-full" style={{ width: `${w}px` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Stats Skeleton
────────────────────────────────────────────────────────────── */
function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 bg-card border border-border rounded-xl shadow-card space-y-3">
          <div className="flex justify-between items-center">
            <Sh className="h-3 w-20" />
            <Sh className="size-7 rounded-lg" />
          </div>
          <Sh className="h-7 w-16" />
          <Sh className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Main LoadingState export
────────────────────────────────────────────────────────────── */
export function LoadingState({
  label = "Loading…",
  variant = "spinner",
  count = 3,
}: {
  label?: string;
  variant?: LoadingVariant;
  count?: number;
}) {
  if (variant === "job-card") return <JobCardSkeleton />;

  if (variant === "job-list") {
    return (
      <div className="space-y-3.5 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === "job-grid") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <JobCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (variant === "table") return <TableSkeleton count={count} />;
  if (variant === "job-detail") return <JobDetailSkeleton />;
  if (variant === "profile") return <ProfileSkeleton />;
  if (variant === "resume") return <ResumeSkeleton />;
  if (variant === "stats") return <StatsSkeleton count={count} />;

  // Default spinner
  return (
    <div className="flex items-center justify-center py-16 gap-2.5">
      <div className="size-5 border-2 border-border border-t-accent rounded-full animate-spin" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   EmptyState
────────────────────────────────────────────────────────────── */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="size-14 grid place-items-center rounded-2xl bg-surface border border-border shadow-card mb-4 text-muted-foreground">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h3 className="font-semibold text-foreground text-base">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   ErrorState
────────────────────────────────────────────────────────────── */
export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="size-14 grid place-items-center rounded-2xl bg-destructive/8 border border-destructive/15 text-destructive mb-4">
        <AlertCircle className="size-6" />
      </div>
      <h3 className="font-semibold text-foreground text-base">{message}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
        Please check your connection and try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-surface shadow-card transition-all duration-150 hover:shadow-elevated"
        >
          <RefreshCcw className="size-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}
