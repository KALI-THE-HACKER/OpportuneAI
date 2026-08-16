import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ArrowLeft } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Auth header */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm shadow-sm">
        <Logo />
        <div className="flex items-center gap-2.5">
          <ThemeToggle />
          <Link
            to="/"
            className="
              inline-flex items-center gap-1.5 h-8 px-3 rounded-lg
              border border-border bg-surface
              text-sm text-muted-foreground hover:text-foreground
              hover:bg-card shadow-card hover:shadow-elevated
              transition-all duration-150
            "
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
        </div>
      </div>

      {/* Auth card */}
      <div className="flex-1 grid place-items-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* Card container */}
          <div className="bg-card border border-border rounded-2xl shadow-elevated p-7">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
              {description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {children}
          </div>
          {footer && (
            <div className="mt-5 text-sm text-muted-foreground text-center">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-foreground/80 uppercase tracking-wider block">
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export const inputClass =
  "w-full h-10 px-3.5 rounded-lg bg-background border border-input focus:border-ring focus:ring-2 focus:ring-ring/20 outline-none text-sm transition-all duration-150 placeholder:text-muted-foreground/50 shadow-sm";

export const primaryButtonClass =
  "w-full h-10 inline-flex items-center justify-center rounded-lg bg-brand text-brand-foreground text-sm font-semibold border border-brand/80 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 shadow-sm cursor-pointer";
