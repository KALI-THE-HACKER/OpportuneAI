import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="
        relative size-8 inline-grid place-items-center rounded-lg
        border border-border bg-surface
        text-muted-foreground hover:text-foreground
        hover:bg-card hover:border-border/80
        shadow-card hover:shadow-elevated
        transition-all duration-200 cursor-pointer
        focus-visible:outline-2 focus-visible:outline-ring
      "
    >
      <Sun
        className={`
          size-4 absolute transition-all duration-300
          ${isDark ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"}
        `}
      />
      <Moon
        className={`
          size-4 absolute transition-all duration-300
          ${isDark ? "opacity-0 -rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}
        `}
      />
    </button>
  );
}
