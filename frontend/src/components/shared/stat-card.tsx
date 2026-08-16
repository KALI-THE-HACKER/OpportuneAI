import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  progress,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  progress?: number;
  icon?: ReactNode;
}) {
  return (
    <div className="p-5 bg-card border border-border rounded-xl shadow-card hover:shadow-elevated transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest leading-tight">
          {label}
        </span>
        {icon && (
          <span className="size-7 grid place-items-center rounded-lg bg-surface border border-border text-muted-foreground shrink-0">
            {icon}
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold mt-2 text-foreground tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1.5 w-full bg-surface border border-border/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent/70 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  );
}
