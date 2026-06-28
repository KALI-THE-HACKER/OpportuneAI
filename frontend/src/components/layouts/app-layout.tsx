import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  Search,
  Bookmark,
  Send,
  FileText,
  User,
  Bell,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/recommendations", label: "AI Recommendations", icon: Sparkles },
  { to: "/app/jobs", label: "Job Explorer", icon: Search },
  { to: "/app/saved", label: "Saved", icon: Bookmark },
  { to: "/app/applied", label: "Applications", icon: Send },
  { to: "/app/resume", label: "Resume", icon: FileText },
  { to: "/app/profile", label: "Profile", icon: User },
  { to: "/app/notifications", label: "Notifications", icon: Bell },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/admin", label: "Admin", icon: ShieldCheck },
] as const;

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border flex-col bg-sidebar">
        <div className="h-14 px-5 flex items-center border-b border-border">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 h-8 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-surface text-foreground ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 h-8 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface/60"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 bg-sidebar border-r border-border flex flex-col">
            <div className="h-14 px-5 flex items-center justify-between border-b border-border">
              <Logo />
              <button onClick={() => setMobileOpen(false)} aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {NAV.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 h-9 rounded-md text-sm font-medium ${
                      active
                        ? "bg-surface text-foreground ring-1 ring-border"
                        : "text-muted-foreground hover:text-foreground hover:bg-surface/60"
                    }`}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-border">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 h-9 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface/60"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            <button
              className="lg:hidden size-8 grid place-items-center rounded-md ring-1 ring-border"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </button>
            <div className="hidden lg:block text-xs text-muted-foreground font-mono">
              <span className="inline-flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                PIPELINE ONLINE
              </span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <Link
                to="/app/notifications"
                className="size-8 inline-grid place-items-center rounded-md ring-1 ring-border hover:bg-surface transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="size-4" />
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-accent" />
              </Link>
              <ThemeToggle />
              <Link
                to="/app/profile"
                className="size-8 inline-grid place-items-center rounded-full bg-brand text-brand-foreground text-xs font-medium"
              >
                {user?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2) ?? "AC"}
              </Link>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayoutLoading() {
  return (
    <div className="min-h-screen flex bg-background text-foreground animate-pulse">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border flex-col bg-sidebar">
        <div className="h-14 px-5 flex items-center border-b border-border">
          <Logo />
        </div>
        <nav className="flex-1 p-3 space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 h-8">
              <div className="size-4 bg-muted rounded shrink-0" />
              <div className="h-4 bg-muted rounded w-24" />
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header skeleton */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between">
            <div className="h-4 bg-muted rounded w-32" />
            <div className="flex items-center gap-3">
              <div className="size-8 bg-muted rounded-md" />
              <div className="size-8 bg-muted rounded-md" />
              <div className="size-8 bg-muted rounded-full" />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl w-full mx-auto space-y-8">
          <div className="space-y-2">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-4 bg-muted rounded w-72" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-4 bg-muted rounded w-36" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-6 bg-card ring-1 ring-border rounded-lg space-y-4">
                  <div className="flex gap-4">
                    <div className="size-12 bg-muted rounded-md shrink-0" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              <div className="p-6 bg-card ring-1 ring-border rounded-lg h-40 space-y-4">
                <div className="h-4 bg-muted rounded w-24" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
