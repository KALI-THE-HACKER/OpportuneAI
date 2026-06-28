import { Loader2, AlertCircle, Inbox } from "lucide-react";
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

export function LoadingState({
  label = "Loading…",
  variant = "spinner",
  count = 3,
}: {
  label?: string;
  variant?: LoadingVariant;
  count?: number;
}) {
  if (variant === "job-card") {
    return (
      <div className="animate-pulse p-6 bg-card ring-1 ring-border rounded-lg space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex gap-4 min-w-0 flex-1">
            <div className="size-12 shrink-0 bg-muted rounded-md" />
            <div className="flex-grow space-y-2.5">
              <div className="h-4 bg-muted rounded w-2/5" />
              <div className="h-3 bg-muted rounded w-3/5" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="h-5 bg-muted rounded w-16" />
            <div className="size-4 bg-muted rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <div className="h-5 bg-muted rounded w-14" />
          <div className="h-5 bg-muted rounded w-16" />
          <div className="h-5 bg-muted rounded w-12" />
          <div className="h-5 bg-muted rounded w-20" />
        </div>
      </div>
    );
  }

  if (variant === "job-list") {
    return (
      <div className="space-y-4 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <LoadingState key={i} variant="job-card" />
        ))}
      </div>
    );
  }

  if (variant === "job-grid") {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <LoadingState key={i} variant="job-card" />
        ))}
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div className="animate-pulse bg-card ring-1 ring-border rounded-lg overflow-hidden w-full">
        <div className="bg-surface h-10 border-b border-border flex items-center px-6 gap-4">
          <div className="h-3 bg-muted rounded w-1/4" />
          <div className="h-3 bg-muted rounded w-1/5" />
          <div className="h-3 bg-muted rounded w-1/6" />
          <div className="h-3 bg-muted rounded w-1/6" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="h-14 flex items-center px-6 gap-4">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-4 bg-muted rounded w-1/6" />
              <div className="h-5 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "job-detail") {
    return (
      <div className="animate-pulse space-y-6 w-full">
        <div className="h-4 bg-muted rounded w-28 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="space-y-6">
            <header className="mb-6 flex gap-4">
              <div className="size-14 bg-muted rounded-md shrink-0" />
              <div className="space-y-2.5 flex-grow">
                <div className="h-7 bg-muted rounded w-1/2" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            </header>

            <div className="space-y-3">
              <div className="h-3 bg-muted rounded w-24 uppercase" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="h-3 bg-muted rounded w-28 uppercase" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-11/12" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-6 bg-card ring-1 ring-border rounded-lg space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 bg-muted rounded w-16" />
                <div className="h-4 bg-muted rounded w-20" />
              </div>
              <div className="h-10 bg-muted rounded w-full" />
              <div className="h-10 bg-muted rounded w-full" />
            </div>

            <div className="p-6 bg-card ring-1 ring-border rounded-lg space-y-4">
              <div className="h-4 bg-muted rounded w-24" />
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "profile") {
    return (
      <div className="animate-pulse space-y-6 max-w-2xl w-full">
        <div className="bg-card ring-1 ring-border rounded-lg p-6 space-y-5">
          <div className="h-3 bg-muted rounded w-20 uppercase" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-muted rounded w-16" />
                <div className="h-9 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card ring-1 ring-border rounded-lg p-6 space-y-5">
          <div className="h-3 bg-muted rounded w-32 uppercase" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 bg-muted rounded w-24" />
                <div className="h-9 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "resume") {
    return (
      <div className="animate-pulse p-6 bg-card ring-1 ring-border rounded-lg space-y-5 w-full">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-muted rounded-md shrink-0" />
          <div className="space-y-2 flex-grow">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-3 py-3 border-y border-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-28 uppercase" />
          <div className="flex flex-wrap gap-1.5">
            <div className="h-5 bg-muted rounded w-16" />
            <div className="h-5 bg-muted rounded w-12" />
            <div className="h-5 bg-muted rounded w-20" />
            <div className="h-5 bg-muted rounded w-14" />
          </div>
        </div>
        <div className="h-9 bg-muted rounded w-full" />
      </div>
    );
  }

  if (variant === "stats") {
    return (
      <div className="animate-pulse grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-5 bg-card ring-1 ring-border rounded-lg space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-muted rounded w-20" />
              <div className="size-4 bg-muted rounded" />
            </div>
            <div className="h-7 bg-muted rounded w-16" />
            <div className="h-1 bg-muted rounded w-full mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
      <Loader2 className="size-4 animate-spin text-accent" />
      {label}
    </div>
  );
}

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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="size-10 grid place-items-center rounded-full bg-surface mb-3 text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <h3 className="font-medium text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="size-10 grid place-items-center rounded-full bg-destructive/10 text-destructive mb-3">
        <AlertCircle className="size-5" />
      </div>
      <h3 className="font-medium text-foreground">{message}</h3>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 px-3 h-8 rounded-md ring-1 ring-border text-sm hover:bg-surface"
        >
          Try again
        </button>
      )}
    </div>
  );
}
