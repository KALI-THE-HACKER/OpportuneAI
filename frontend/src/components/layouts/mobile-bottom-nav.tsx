import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Search, Sparkles, Send, Menu } from "lucide-react";

interface MobileBottomNavProps {
  unreadCount?: number;
  onMenuClick: () => void;
}

export function MobileBottomNav({ unreadCount = 0, onMenuClick }: MobileBottomNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const tabs = [
    {
      to: "/app/dashboard",
      label: "Home",
      icon: LayoutDashboard,
      active: pathname === "/app/dashboard" || pathname === "/app" || pathname === "/app/",
    },
    {
      to: "/app/jobs",
      label: "Jobs",
      icon: Search,
      active: pathname.startsWith("/app/jobs"),
    },
    {
      to: "/app/recommendations",
      label: "Matches",
      icon: Sparkles,
      active: pathname.startsWith("/app/recommendations"),
      highlight: true,
    },
    {
      to: "/app/applied",
      label: "Applied",
      icon: Send,
      active: pathname.startsWith("/app/applied"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-xl border-t border-border shadow-elevated pwa-chrome"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div className="flex items-center justify-around h-13 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-150 relative cursor-pointer ${
                tab.active
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon
                  className={`size-5 transition-transform duration-150 ${
                    tab.active ? "scale-110 text-primary" : ""
                  } ${tab.highlight && !tab.active ? "text-accent" : ""}`}
                />
                {tab.active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-[10px] mt-1 tracking-tight truncate max-w-[56px]">
                {tab.label}
              </span>
            </Link>
          );
        })}

        {/* More / Menu Drawer Trigger */}
        <button
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center flex-1 py-1 text-muted-foreground hover:text-foreground transition-all duration-150 relative cursor-pointer"
          aria-label="Open full menu"
        >
          <div className="relative">
            <Menu className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-accent border-2 border-background animate-pulse" />
            )}
          </div>
          <span className="text-[10px] mt-1 tracking-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
}
