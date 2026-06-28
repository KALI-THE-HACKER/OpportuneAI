import { Loader2, AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
      <Loader2 className="size-4 animate-spin" />
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
