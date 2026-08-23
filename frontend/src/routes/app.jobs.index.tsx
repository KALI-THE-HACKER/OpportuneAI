import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Search, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { jobsApi } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { JobCard } from "@/components/shared/job-card";
import { LoadingState, ErrorState, EmptyState } from "@/components/shared/state-views";

const searchSchema = z.object({
  q: z.string().optional(),
  workMode: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  level: z.array(z.string()).optional(),
  minSalary: z.number().optional(),
  sort: z.enum(["relevance", "recent", "salary-high", "salary-low"]).optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/app/jobs/")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Job explorer · OpportuneAI" }] }),
  component: JobExplorer,
});

const WORK_MODES = ["remote", "hybrid", "on-site"];
const TYPES = ["full-time", "part-time", "contract", "internship"];
const LEVELS = ["Mid", "Senior", "Lead", "Principal"];
const SORTS = [
  { value: "relevance", label: "Best match" },
  { value: "recent", label: "Newest" },
  { value: "salary-high", label: "Salary: High → Low" },
  { value: "salary-low", label: "Salary: Low → High" },
] as const;

function JobExplorer() {
  const search = useSearch({ from: "/app/jobs/" });
  const navigate = useNavigate({ from: "/app/jobs/" });
  const qc = useQueryClient();
  const page = search.page ?? 1;

  const query = useQuery({
    queryKey: ["jobs", search],
    queryFn: () =>
      jobsApi.list({
        q: search.q,
        workMode: search.workMode,
        type: search.type,
        experienceLevel: search.level,
        minSalary: search.minSalary,
        sort: search.sort ?? "relevance",
        page,
        pageSize: 8,
      }),
  });

  function update(patch: Partial<typeof search>) {
    navigate({ search: (prev: typeof search) => ({ ...prev, ...patch, page: 1 }) });
  }

  function toggle(key: "workMode" | "type" | "level", value: string) {
    const cur = (search[key] ?? []) as string[];
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    update({ [key]: next.length ? next : undefined } as Partial<typeof search>);
  }

  async function toggleSave(id: string) {
    await jobsApi.toggleSave(id, "search");
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["feed"] });
    qc.invalidateQueries({ queryKey: ["saved"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  const totalPages = query.data
    ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize))
    : 1;

  // Count active filters
  const activeFilters =
    (search.workMode?.length ?? 0) +
    (search.type?.length ?? 0) +
    (search.level?.length ?? 0) +
    (search.minSalary ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Job explorer"
        description="Search, filter, and sort high-signal opportunities matched to your profile."
      />

      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-6">
        {/* Filter sidebar */}
        <aside className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <SlidersHorizontal className="size-3.5" />
              Filters
            </div>
            {activeFilters > 0 && (
              <button
                onClick={() =>
                  update({
                    workMode: undefined,
                    type: undefined,
                    level: undefined,
                    minSalary: undefined,
                  })
                }
                className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
              >
                <X className="size-3" />
                Clear all ({activeFilters})
              </button>
            )}
          </div>

          <FilterGroup label="Work mode">
            {WORK_MODES.map((m) => (
              <FilterCheck
                key={m}
                label={m}
                checked={search.workMode?.includes(m) ?? false}
                onChange={() => toggle("workMode", m)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Type">
            {TYPES.map((t) => (
              <FilterCheck
                key={t}
                label={t}
                checked={search.type?.includes(t) ?? false}
                onChange={() => toggle("type", t)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Experience">
            {LEVELS.map((l) => (
              <FilterCheck
                key={l}
                label={l}
                checked={search.level?.includes(l) ?? false}
                onChange={() => toggle("level", l)}
              />
            ))}
          </FilterGroup>

          <FilterGroup label="Min salary (USD)">
            <input
              type="number"
              step={10000}
              placeholder="e.g. 120,000"
              className="
                w-full h-9 px-3 rounded-lg bg-background border border-input
                text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20
                transition-all duration-150 shadow-sm
              "
              value={search.minSalary ?? ""}
              onChange={(e) =>
                update({ minSalary: e.target.value ? Number(e.target.value) : undefined })
              }
            />
          </FilterGroup>
        </aside>

        {/* Results */}
        <div className="min-w-0">
          {/* Search bar + sort */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                placeholder="Search titles, companies, skills…"
                className="
                  w-full h-10 pl-10 pr-3.5 rounded-lg bg-background border border-input
                  text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20
                  transition-all duration-150 shadow-sm
                "
                value={search.q ?? ""}
                onChange={(e) => update({ q: e.target.value || undefined })}
              />
              {search.q && (
                <button
                  onClick={() => update({ q: undefined })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <select
              value={search.sort ?? "relevance"}
              onChange={(e) => update({ sort: e.target.value as typeof search.sort })}
              className="
                h-10 px-3 pr-8 rounded-lg bg-background border border-input
                text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20
                transition-all duration-150 shadow-sm cursor-pointer
              "
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {query.isLoading ? (
            <LoadingState variant="job-list" count={5} />
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : query.data!.items.length === 0 ? (
            <EmptyState
              title="No jobs match these filters"
              description="Try widening your salary, location, or experience filters."
              action={
                <button
                  onClick={() =>
                    update({
                      workMode: undefined,
                      type: undefined,
                      level: undefined,
                      minSalary: undefined,
                      q: undefined,
                    })
                  }
                  className="h-9 px-4 inline-flex items-center rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-surface shadow-card transition-all"
                >
                  Clear all filters
                </button>
              }
            />
          ) : (
            <>
              <div className="text-xs text-muted-foreground mb-4 font-medium">
                {query.data!.total.toLocaleString()} results
              </div>
              <div className="space-y-3.5">
                {query.data!.items.map((j, idx) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    onToggleSave={toggleSave}
                    position={(page - 1) * 8 + idx}
                    source={search.q ? "search" : "feed"}
                  />
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex items-center justify-between">
                <button
                  disabled={page <= 1}
                  onClick={() =>
                    navigate({ search: (p: typeof search) => ({ ...p, page: page - 1 }) })
                  }
                  className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium disabled:opacity-40 hover:bg-surface shadow-card transition-all duration-150"
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </button>
                <span className="text-xs text-muted-foreground font-mono">
                  Page {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() =>
                    navigate({ search: (p: typeof search) => ({ ...p, page: page + 1 }) })
                  }
                  className="h-9 px-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium disabled:opacity-40 hover:bg-surface shadow-card transition-all duration-150"
                >
                  Next
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
        {label}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FilterCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer group">
      <div
        className={`size-4 rounded flex items-center justify-center border transition-all duration-150 shrink-0 ${
          checked
            ? "bg-brand border-brand"
            : "bg-background border-input group-hover:border-foreground/40"
        }`}
        onClick={onChange}
      >
        {checked && (
          <svg className="size-2.5 text-brand-foreground" viewBox="0 0 10 10" fill="none">
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
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className="capitalize">{label}</span>
    </label>
  );
}
