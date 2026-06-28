import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { userApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState } from "@/components/shared/state-views";
import type { UserProfile } from "@/lib/mock/user";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Profile & preferences · OpportuneAI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["user"], queryFn: () => userApi.get() });
  const update = useMutation({
    mutationFn: (patch: Partial<UserProfile>) => userApi.update(patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user"] }),
  });

  const [form, setForm] = useState<UserProfile | null>(null);
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  if (q.isLoading || !form) return <LoadingState />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader title="Profile & preferences" description="Tune what we look for on your behalf." />
      <form
        onSubmit={(e) => { e.preventDefault(); update.mutate(form); }}
        className="max-w-2xl space-y-6"
      >
        <Card title="Identity">
          <Row label="Name"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Row>
          <Row label="Title"><Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} /></Row>
          <Row label="Location"><Input value={form.location} onChange={(v) => setForm({ ...form, location: v })} /></Row>
          <Row label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              className="w-full min-h-24 px-3 py-2 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </Row>
        </Card>

        <Card title="Job preferences">
          <Row label="Preferred roles">
            <Input
              value={form.preferredRoles.join(", ")}
              onChange={(v) => setForm({ ...form, preferredRoles: v.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Row>
          <Row label="Preferred locations">
            <Input
              value={form.preferredLocations.join(", ")}
              onChange={(v) => setForm({ ...form, preferredLocations: v.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Row>
          <Row label="Min salary (USD)">
            <Input type="number" value={String(form.minSalary)} onChange={(v) => setForm({ ...form, minSalary: Number(v) || 0 })} />
          </Row>
          <Row label="Work mode">
            <div className="flex gap-3">
              {(["remote","hybrid","on-site"] as const).map((m) => (
                <label key={m} className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.workModes.includes(m)}
                    onChange={() => setForm({ ...form, workModes: form.workModes.includes(m) ? form.workModes.filter((x) => x !== m) : [...form.workModes, m] })}
                    className="size-4 accent-accent"
                  />
                  <span className="capitalize">{m}</span>
                </label>
              ))}
            </div>
          </Row>
        </Card>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={update.isPending}
            className="h-10 px-5 inline-flex items-center rounded-md bg-brand text-brand-foreground text-sm font-medium ring-1 ring-brand hover:bg-brand/90 disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </button>
          {update.isSuccess && <span className="text-xs text-accent">Saved</span>}
        </div>
      </form>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card ring-1 ring-border rounded-lg p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
function Input({ value, onChange, type = "text" }: { value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent"
    />
  );
}