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
  ChevronRight,
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
  { to: "/app/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
] as const;

function NavItem({
  to,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        group flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm font-medium
        transition-all duration-150 cursor-pointer
        ${
          active
            ? "bg-brand text-brand-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-surface"
        }
      `}
    >
      <Icon
        className={`size-4 shrink-0 transition-colors duration-150 ${
          active ? "text-brand-foreground" : "text-muted-foreground group-hover:text-foreground"
        }`}
      />
      <span className="truncate">{label}</span>
      {active && <ChevronRight className="size-3 ml-auto opacity-60" />}
    </Link>
  );
}

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth/sign-in", replace: true });
  }

  const userInitials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "ME";

  const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
    <>
      {/* Logo header */}
      <div className="h-14 px-4 flex items-center border-b border-border shrink-0">
        <Logo />
      </div>

      {/* Nav links */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.filter((item) => !("adminOnly" in item && item.adminOnly) || user?.role === "admin").map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={active}
              onClick={onNavClick}
            />
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border space-y-1 shrink-0">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-1">
            <div className="size-7 rounded-full bg-brand text-brand-foreground text-xs font-semibold grid place-items-center shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{user.name ?? "User"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 px-3 h-8 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-surface transition-all duration-150 cursor-pointer"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border flex-col bg-sidebar sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer panel */}
          <aside className="relative w-72 h-full bg-sidebar border-r border-border flex flex-col shadow-dropdown animate-in slide-in-from-left-4 duration-200">
            <div className="absolute top-3 right-3">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="size-8 grid place-items-center rounded-lg border border-border bg-card hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <SidebarContent onNavClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top header */}
        <header className="h-14 border-b border-border bg-background/90 backdrop-blur-md sticky top-0 z-40 shadow-sm">
          <div className="h-full px-4 sm:px-5 flex items-center justify-between gap-3">
            {/* Mobile menu button */}
            <button
              className="lg:hidden size-8 grid place-items-center rounded-lg border border-border bg-card hover:bg-surface text-muted-foreground hover:text-foreground transition-colors shadow-card"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="size-4" />
            </button>

            {/* Pipeline status — desktop only */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="size-1.5 rounded-full bg-accent animate-pulse-glow" />
              PIPELINE ONLINE
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 ml-auto">
              {/* Notifications */}
              <Link
                to="/app/notifications"
                className="relative size-8 inline-grid place-items-center rounded-lg border border-border bg-card hover:bg-surface text-muted-foreground hover:text-foreground transition-all duration-150 shadow-card hover:shadow-elevated"
                aria-label="View notifications"
              >
                <Bell className="size-4" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent border-2 border-background" />
              </Link>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* User avatar */}
              <Link
                to="/app/profile"
                className="size-8 inline-grid place-items-center rounded-full bg-brand text-brand-foreground text-xs font-semibold border-2 border-background ring-1 ring-border hover:ring-accent transition-all duration-200 shadow-card"
                aria-label="View profile"
              >
                {userInitials}
              </Link>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   AppLayoutLoading — Full skeleton of the shell
────────────────────────────────────────────────────────────── */
export function AppLayoutLoading() {
  function Sh({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
    return <div className={`skeleton-shimmer rounded-md ${className}`} style={style} />;
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar skeleton */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border flex-col bg-sidebar sticky top-0 h-screen">
        {/* Logo skeleton */}
        <div className="h-14 px-4 flex items-center border-b border-border">
          <div className="flex items-center gap-2.5">
            <Sh className="size-6 rounded-md" />
            <Sh className="h-4 w-24" />
          </div>
        </div>
        {/* Nav items */}
        <nav className="flex-1 p-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 h-9">
              <Sh className="size-4 rounded-sm shrink-0" />
              <Sh className={`h-3.5 rounded ${i % 3 === 0 ? "w-28" : i % 3 === 1 ? "w-24" : "w-20"}`} />
            </div>
          ))}
        </nav>
        {/* User footer */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <Sh className="size-7 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Sh className="h-3 w-24" />
              <Sh className="h-2.5 w-32" />
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-3 h-8">
            <Sh className="size-4 rounded-sm" />
            <Sh className="h-3 w-16" />
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header skeleton */}
        <header className="h-14 border-b border-border bg-background/90 sticky top-0 z-40">
          <div className="h-full px-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sh className="h-3 w-3 rounded-full" />
              <Sh className="h-3 w-28" />
            </div>
            <div className="flex items-center gap-2">
              <Sh className="size-8 rounded-lg" />
              <Sh className="size-8 rounded-lg" />
              <Sh className="size-8 rounded-full" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 py-8 max-w-7xl w-full mx-auto space-y-8">
          {/* Page header */}
          <div className="space-y-2 pb-5 border-b border-border">
            <Sh className="h-7 w-52" />
            <Sh className="h-4 w-72" />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 bg-card border border-border rounded-xl shadow-card space-y-3">
                <div className="flex justify-between items-center">
                  <Sh className="h-3 w-20" />
                  <Sh className="size-7 rounded-lg" />
                </div>
                <Sh className="h-7 w-16" />
                <Sh className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>

          {/* Two column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3.5">
              <Sh className="h-4 w-36" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
                  <div className="flex gap-3.5">
                    <Sh className="size-11 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Sh className="h-4 w-1/3" />
                      <Sh className="h-3 w-1/2" />
                    </div>
                    <Sh className="h-6 w-16 rounded-full shrink-0" />
                  </div>
                  <div className="flex gap-1.5">
                    {[60, 80, 50, 70, 55].map((w, j) => (
                      <Sh key={j} className="h-5 rounded-full" style={{ width: `${w}px` }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="p-5 bg-card border border-border rounded-xl shadow-card space-y-4">
                <Sh className="h-3 w-28" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                      <Sh className="h-3 w-24" />
                      <Sh className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
