import { Link, Outlet } from "@tanstack/react-router";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/auth/sign-in"
              className="h-8 px-3 inline-flex items-center text-sm font-medium text-foreground hover:text-accent transition-colors"
            >
              Sign in
            </Link>
            <Link
              to="/auth/sign-up"
              className="h-8 px-3 inline-flex items-center text-sm font-medium bg-brand text-brand-foreground rounded-md ring-1 ring-brand hover:bg-brand/90 transition-colors"
            >
              Get access
            </Link>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="py-10 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="flex gap-4 text-xs font-medium text-muted-foreground">
              <a href="#" className="hover:text-foreground">Privacy</a>
              <a href="#" className="hover:text-foreground">Terms</a>
              <a href="#" className="hover:text-foreground">Security</a>
            </nav>
          </div>
          <div className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">
            © 2026 OpportuneAI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}