import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Sparkles, CheckCircle2 } from "lucide-react";
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
      void qc.invalidateQueries({ queryKey: ["user"] });
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
      if (q.data.yearsOfExperience !== undefined) {
        const yrs = q.data.yearsOfExperience;
        if (yrs <= 2) setExpLevel(EXPERIENCE_LEVELS[1]);
        else if (yrs <= 5) setExpLevel(EXPERIENCE_LEVELS[2]);
        else if (yrs <= 8) setExpLevel(EXPERIENCE_LEVELS[3]);
        else if (yrs <= 12) setExpLevel(EXPERIENCE_LEVELS[4]);
        else setExpLevel(EXPERIENCE_LEVELS[5]);
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
        <div className="mb-6 p-4 bg-accent/5 border border-accent/20 rounded-xl flex items-center justify-between gap-4 w-full">
          <div>
            <h4 className="text-sm font-semibold text-accent flex items-center gap-1.5">
              <Sparkles className="size-4 animate-pulse" />
              Step 1: Complete your profile
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Please enter your target job title, preferences, and details. This helps OpportuneAI
              filter relevant job matching signals.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        {/* Left column: Profile Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(form);
          }}
          className="lg:col-span-7 space-y-6"
        >
          {/* Identity & Target Role */}
          <Card title="Identity & Target Role">
            <Row label="Full name">
              <Input
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                placeholder="Alex Morgan"
              />
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
                className="w-full min-h-24 px-3 py-2 rounded-lg bg-background border border-input text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-150 resize-none shadow-sm placeholder:text-muted-foreground/50"
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
                value={String(form.minSalary || "")}
                onChange={(v) => setForm({ ...form, minSalary: Number(v) || 0 })}
                placeholder="e.g. 140000"
              />
            </Row>

            <Row label="Work mode preference">
              <div className="flex flex-wrap gap-4 pt-1">
                {(["remote", "hybrid", "on-site"] as const).map((m) => (
                  <label
                    key={m}
                    className="text-sm flex items-center gap-2 cursor-pointer select-none"
                  >
                    <div
                      className={`size-4 rounded flex items-center justify-center border transition-all duration-150 shrink-0 cursor-pointer ${
                        form.workModes.includes(m)
                          ? "bg-brand border-brand"
                          : "bg-background border-input hover:border-foreground/40"
                      }`}
                      onClick={() =>
                        setForm({
                          ...form,
                          workModes: form.workModes.includes(m)
                            ? form.workModes.filter((x) => x !== m)
                            : [...form.workModes, m],
                        })
                      }
                    >
                      {form.workModes.includes(m) && (
                        <svg
                          className="size-2.5 text-brand-foreground"
                          viewBox="0 0 10 10"
                          fill="none"
                        >
                          <path
                            d="M1.5 5L4 7.5L8.5 2.5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
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
                      className="sr-only"
                    />
                    <span className="capitalize">{m}</span>
                  </label>
                ))}
              </div>
            </Row>
          </Card>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={update.isPending}
              className="h-10 px-5 inline-flex items-center gap-2 rounded-lg bg-brand text-brand-foreground text-sm font-semibold border border-brand/80 hover:opacity-90 disabled:opacity-60 shadow-sm transition-all duration-150 cursor-pointer"
            >
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
            {update.isSuccess && (
              <span className="text-xs text-accent flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="size-3.5" />
                Saved
              </span>
            )}
          </div>
        </form>

        {/* Right column: Experience & Seniority + Resume insights */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
          {/* Experience & Seniority Card */}
          <Card title="Experience & Seniority">
            <Row label="Experience level">
              <SearchCombobox
                value={expLevel}
                onChange={(v) => {
                  setExpLevel(v);
                  if (form) {
                    if (v.includes("1-2")) setForm({ ...form, yearsOfExperience: 2 });
                    else if (v.includes("3-5")) setForm({ ...form, yearsOfExperience: 4 });
                    else if (v.includes("5-8")) setForm({ ...form, yearsOfExperience: 6 });
                    else if (v.includes("8-12")) setForm({ ...form, yearsOfExperience: 10 });
                    else if (v.includes("12+")) setForm({ ...form, yearsOfExperience: 12 });
                  }
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
                placeholder="e.g. 5"
              />
            </Row>
          </Card>

          {/* Resume insights — skills management */}
          <ResumeInsights userSkills={q.data?.skills ?? []} className="w-full shadow-card" />
        </div>
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl shadow-card p-6">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-9 px-3 rounded-lg bg-background border border-input text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all duration-150 shadow-sm placeholder:text-muted-foreground/50"
    />
  );
}
