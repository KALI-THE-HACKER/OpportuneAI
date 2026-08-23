export function formatSalary(min: number, max: number, currency = "USD") {
  const fmt = (n: number) => `$${Math.round(n / 1000)}k`;
  return `${fmt(min)}–${fmt(max)} ${currency}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

export function formatApplyDeadline(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Expired";
  if (diffDays === 0) return "Apply today";
  if (diffDays === 1) return "Apply by tomorrow";
  if (diffDays <= 7) return `Apply in ${diffDays}d`;

  return `Apply by ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}
