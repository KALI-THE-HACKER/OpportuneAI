import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/shared/page-header";

export const Route = createFileRoute("/app/settings")({
  head: () => ({ meta: [{ title: "Settings · OpportuneAI" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [emailDigest, setEmailDigest] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);

  return (
    <>
      <PageHeader
        title="Settings"
        description="Account, appearance, and notification preferences."
      />

      <div className="max-w-lg space-y-4">
        <SettingsCard title="Account">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Email verified" value={user?.emailVerified ? "Yes" : "No"} />
        </SettingsCard>

        <SettingsCard title="Appearance">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Theme
            </div>
            <div className="flex gap-2">
              {(["light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`h-9 px-5 rounded-lg text-sm font-medium capitalize border transition-all duration-150 ${
                    theme === t
                      ? "bg-brand text-brand-foreground border-brand/80 shadow-sm"
                      : "bg-background text-foreground border-border hover:bg-surface shadow-card"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </SettingsCard>

        <SettingsCard title="Notifications">
          <Toggle
            label="Weekly email digest"
            description="Receive a weekly summary of top job matches"
            checked={emailDigest}
            onChange={setEmailDigest}
          />
          <Toggle
            label="New match alerts"
            description="Get notified when a 90%+ match is discovered"
            checked={pushAlerts}
            onChange={setPushAlerts}
          />
        </SettingsCard>

        <SettingsCard title="Danger zone">
          <button className="h-9 px-4 rounded-lg text-sm font-medium border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors duration-150">
            Delete account
          </button>
        </SettingsCard>
      </div>
    </>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer group">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground mt-0.5">{description}</div>}
      </div>
      <div className="relative shrink-0 mt-0.5">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`h-5 w-9 rounded-full relative transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring cursor-pointer ${
            checked ? "bg-brand" : "bg-input"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-200 pointer-events-none ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </label>
  );
}
