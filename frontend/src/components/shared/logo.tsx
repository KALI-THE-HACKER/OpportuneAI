import { Link } from "@tanstack/react-router";

export function Logo({ to = "/", className = "" }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2 ${className}`}>
      <span className="size-5 rounded-sm bg-brand grid place-items-center">
        <span className="size-1.5 rounded-full bg-accent" />
      </span>
      <span className="font-semibold tracking-tight text-foreground">
        Opportune<span className="text-accent">AI</span>
      </span>
    </Link>
  );
}