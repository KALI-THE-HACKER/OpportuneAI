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

      <div className="max-w-2xl space-y-6">
        <Section title="Account">
          <Row label="Email" value={user?.email ?? ""} />
          <Row label="Email verified" value={user?.emailVerified ? "Yes" : "No"} />
        </Section>

        <Section title="Appearance">
          <div className="text-xs font-medium text-foreground mb-2">Theme</div>
          <div className="flex gap-2">
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`h-9 px-4 rounded-md text-sm ring-1 capitalize ${
                  theme === t
                    ? "bg-brand text-brand-foreground ring-brand"
                    : "ring-border bg-background hover:bg-surface"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Notifications">
          <Toggle label="Weekly email digest" checked={emailDigest} onChange={setEmailDigest} />
          <Toggle
            label="Push alerts for new 90%+ matches"
            checked={pushAlerts}
            onChange={setPushAlerts}
          />
        </Section>

        <Section title="Danger zone">
          <button className="h-9 px-4 rounded-md text-sm ring-1 ring-destructive/40 text-destructive hover:bg-destructive/5">
            Delete account
          </button>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card ring-1 ring-border rounded-lg p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`h-5 w-9 rounded-full relative transition-colors ${checked ? "bg-accent" : "bg-muted ring-1 ring-border"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}
