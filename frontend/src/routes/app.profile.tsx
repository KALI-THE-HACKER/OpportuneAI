import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { userApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, ErrorState } from "@/components/shared/state-views";
import { ResumeInsights } from "@/components/profile/resume-insights";
import { SearchCombobox, MultiSearchCombobox } from "@/components/profile/search-combobox";
import {
  EXPERIENCE_LEVELS,
  STANDARD_JOB_TITLES,
  STANDARD_LOCATIONS,
  STANDARD_ROLES,
} from "@/lib/data/profile-options";
import type { UserProfile } from "@/lib/mock/user";

const profileSearchSchema = z.object({
  onboarding: z.string().optional(),
});

export const Route = createFileRoute("/app/profile")({
  validateSearch: profileSearchSchema,
  head: () => ({ meta: [{ title: "Profile & preferences · OpportuneAI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/app/profile" });
  const navigate = useNavigate();

  const q = useQuery({ queryKey: ["user"], queryFn: () => userApi.get() });
  const update = useMutation({
    mutationFn: (patch: Partial<UserProfile>) => userApi.update(patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user"] });
      if (search.onboarding === "true") {
        void navigate({ to: "/app/resume", search: { onboarding: "true" } });
      }
    },
  });

  const [form, setForm] = useState<UserProfile | null>(null);
  const [expLevel, setExpLevel] = useState<string>("");

  useEffect(() => {
    if (q.data) {
      setForm(q.data);
      // Derive closest experience level from years
      if (q.data.yearsOfExperience !== undefined) {
        const yrs = q.data.yearsOfExperience;
        if (yrs <= 2) setExpLevel(EXPERIENCE_LEVELS[1]); // Junior
        else if (yrs <= 5) setExpLevel(EXPERIENCE_LEVELS[2]); // Mid-Level
        else if (yrs <= 8) setExpLevel(EXPERIENCE_LEVELS[3]); // Senior
        else if (yrs <= 12) setExpLevel(EXPERIENCE_LEVELS[4]); // Staff
        else setExpLevel(EXPERIENCE_LEVELS[5]); // Principal
      }
    }
  }, [q.data]);

  if (q.isLoading || !form) return <LoadingState variant="profile" />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;

  return (
    <>
      <PageHeader
        title="Profile & preferences"
        description="Tune what we look for on your behalf."
      />

      {search.onboarding === "true" && (
        <div className="mb-6 p-4 bg-accent/5 ring-1 ring-accent/20 rounded-lg flex items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-accent flex items-center gap-1.5">
              <Sparkles className="size-4 animate-pulse" /> Step 1: Complete your profile
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Please enter your target job title, preferences, and details. This helps OpportuneAI
              filter relevant job matching signals.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(form);
          }}
          className="lg:col-span-7 space-y-6"
        >
          {/* Identity & Current Role */}
          <Card title="Identity & Target Role">
            <Row label="Full name">
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            </Row>

            <Row label="Target job title">
              <SearchCombobox
                value={form.title}
                onChange={(v) => setForm({ ...form, title: v })}
                options={STANDARD_JOB_TITLES}
                placeholder="Search or type job title (e.g. Senior Software Engineer)..."
              />
            </Row>

            <Row label="Current location">
              <SearchCombobox
                value={form.location}
                onChange={(v) => setForm({ ...form, location: v })}
                options={STANDARD_LOCATIONS}
                placeholder="Search or enter location (e.g. San Francisco, CA, Remote)..."
              />
            </Row>

            <Row label="Bio / Summary">
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Brief summary of your professional background..."
                className="w-full min-h-24 px-3 py-2 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </Row>
          </Card>



          {/* Job preferences */}
          <Card title="Job Preferences & Targets">
            <Row label="Preferred roles (search & select)">
              <MultiSearchCombobox
                values={form.preferredRoles}
                onChange={(roles) => setForm({ ...form, preferredRoles: roles })}
                options={STANDARD_ROLES}
                placeholder="Search preferred roles to add..."
              />
            </Row>

            <Row label="Preferred locations (search & select)">
              <MultiSearchCombobox
                values={form.preferredLocations}
                onChange={(locs) => setForm({ ...form, preferredLocations: locs })}
                options={STANDARD_LOCATIONS}
                placeholder="Search locations to add (e.g. Remote, New York)..."
              />
            </Row>

            <Row label="Minimum expected salary (USD / year)">
              <Input
                type="number"
                value={String(form.minSalary)}
                onChange={(v) => setForm({ ...form, minSalary: Number(v) || 0 })}
              />
            </Row>

            <Row label="Work mode preference">
              <div className="flex gap-4 pt-1">
                {(["remote", "hybrid", "on-site"] as const).map((m) => (
                  <label key={m} className="text-sm flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.workModes.includes(m)}
                      onChange={() =>
                        setForm({
                          ...form,
                          workModes: form.workModes.includes(m)
                            ? form.workModes.filter((x) => x !== m)
                            : [...form.workModes, m],
                        })
                      }
                      className="size-4 accent-accent cursor-pointer"
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
              className="h-10 px-5 inline-flex items-center rounded-md bg-brand text-brand-foreground text-sm font-medium ring-1 ring-brand hover:bg-brand/90 disabled:opacity-60 transition-opacity"
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
            {update.isSuccess && <span className="text-xs text-accent">Saved</span>}
          </div>
        </form>



        {/* Resume insights — skills management */}
        <div className="lg:col-span-5 space-y-6">
          {/* Experience & Seniority */}
          <Card title="Experience & Seniority">
            <Row label="Experience level">
              <SearchCombobox
                value={expLevel}
                onChange={(v) => {
                  setExpLevel(v);
                  // Approximate years if needed
                  if (v.includes("1-2")) setForm({ ...form, yearsOfExperience: 2 });
                  else if (v.includes("3-5")) setForm({ ...form, yearsOfExperience: 4 });
                  else if (v.includes("5-8")) setForm({ ...form, yearsOfExperience: 6 });
                  else if (v.includes("8-12")) setForm({ ...form, yearsOfExperience: 10 });
                  else if (v.includes("12+")) setForm({ ...form, yearsOfExperience: 12 });
                }}
                options={EXPERIENCE_LEVELS}
                placeholder="Search experience level (e.g. Senior, Mid-Level)..."
              />
            </Row>

            <Row label="Years of experience">
              <Input
                type="number"
                value={String(form.yearsOfExperience ?? 0)}
                onChange={(v) =>
                  setForm({
                    ...form,
                    yearsOfExperience: Math.max(0, Number(v) || 0),
                  })
                }
              />
            </Row>
          </Card>
          <ResumeInsights userSkills={q.data?.skills ?? []} />
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card ring-1 ring-border rounded-lg p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground block">{label}</label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent transition-all"
    />
  );
}


