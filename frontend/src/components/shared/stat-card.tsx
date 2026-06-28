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
    <div className="p-5 bg-card ring-1 ring-border rounded-lg">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="text-2xl font-medium mt-1 text-foreground">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      {progress !== undefined && (
        <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
