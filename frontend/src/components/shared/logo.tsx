import { Link } from "@tanstack/react-router";

export function Logo({ to = "/", className = "" }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={`inline-flex items-center group ${className}`}>
      <img
        src="https://cdn.luckylinux.dev/opportuneai-assets/OpportuneAI-logo.png"
        alt="OpportuneAI"
        className="h-7 w-auto dark:hidden"
      />
      <img
        src="https://cdn.luckylinux.dev/opportuneai-assets/OpportuneAI-logo.png"
        alt="OpportuneAI"
        className="h-7 w-auto hidden dark:block"
      />
      <span className="font-semibold tracking-tight text-foreground text-sm">
        Opportune<span className="text-blue-500">AI</span>
      </span>
    </Link>
  );
}
