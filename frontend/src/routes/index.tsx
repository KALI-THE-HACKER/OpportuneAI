import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Search, FileText, ShieldCheck, BarChart3, Bell } from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OpportuneAI — The intelligence layer for your professional search" },
      { name: "description", content: "Direct access to the hidden job market. AI matching, skill-gap analysis, and an application tracker built for serious job seekers." },
      { property: "og:title", content: "OpportuneAI — The intelligence layer for your professional search" },
      { property: "og:description", content: "AI-powered job discovery and application copilot." },
    ],
  }),
  component: LandingPage,
});

const features = [
  { icon: Sparkles, title: "AI-ranked recommendations", body: "Roles ordered by match score, recency, and signal — not vanity filters." },
  { icon: Search, title: "Deep job explorer", body: "Search, filter, and sort across thousands of high-signal opportunities." },
  { icon: FileText, title: "Resume intelligence", body: "Upload once. We extract skills, level, and projects to power every match." },
  { icon: BarChart3, title: "Skill-gap insights", body: "See exactly which skills move you from 80% to 95% for the role you want." },
  { icon: Bell, title: "Application tracker", body: "Saved, applied, interviewing — one calm surface for the whole pipeline." },
  { icon: ShieldCheck, title: "Yours alone", body: "Your profile stays private. We share with employers only when you apply." },
];

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/auth/sign-in" className="h-8 px-3 inline-flex items-center text-sm font-medium text-foreground hover:text-accent transition-colors">Sign in</Link>
            <Link to="/auth/sign-up" className="h-8 px-3 inline-flex items-center text-sm font-medium bg-brand text-brand-foreground rounded-md ring-1 ring-brand hover:bg-brand/90 transition-colors">Get access</Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/5 ring-1 ring-brand/10 mb-8">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">System online · v2.04</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-semibold leading-tight text-balance mb-6">
              The intelligence layer for your professional search
            </h1>
            <p className="text-lg text-muted-foreground max-w-[56ch] mx-auto text-pretty mb-10">
              Direct access to the hidden market. Automated matching for high-signal opportunities with calculated skill-gap analysis.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Link to="/auth/sign-up" className="h-10 px-5 inline-flex items-center gap-2 bg-brand text-brand-foreground text-sm font-medium rounded-md ring-1 ring-brand hover:bg-brand/90 transition-colors">
                Access platform <ArrowRight className="size-4" />
              </Link>
              <Link to="/auth/sign-in" className="h-10 px-5 inline-flex items-center text-sm font-medium rounded-md ring-1 ring-border bg-background hover:bg-surface transition-colors">
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16 px-6 bg-surface border-y border-border">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Capabilities</span>
              <h2 className="text-3xl font-semibold mt-2">Built for serious operators, not casual swiping.</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="p-6 bg-card ring-1 ring-border rounded-lg">
                  <div className="size-9 grid place-items-center rounded-md bg-brand text-brand-foreground mb-4">
                    <Icon className="size-4" />
                  </div>
                  <h3 className="font-medium mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-semibold mb-4">Your unfair advantage in the market.</h2>
            <p className="text-muted-foreground mb-8">Join thousands of senior operators who've replaced spreadsheets and tab chaos with a single calm copilot.</p>
            <Link to="/auth/sign-up" className="h-10 px-5 inline-flex items-center gap-2 bg-brand text-brand-foreground text-sm font-medium rounded-md ring-1 ring-brand hover:bg-brand/90 transition-colors">
              Get started <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
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
            © 2026 OpportuneAI · All rights reserved
          </div>
        </div>
      </footer>
    </div>
  );
}
