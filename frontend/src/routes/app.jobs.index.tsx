import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
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
  { value: "relevance", label: "Relevance" },
  { value: "recent", label: "Newest" },
  { value: "salary-high", label: "Salary ↓" },
  { value: "salary-low", label: "Salary ↑" },
] as const;

function JobExplorer() {
  const search = useSearch({ from: "/app/jobs/" });
  const navigate = useNavigate({ from: "/app/jobs/" });
  const qc = useQueryClient();
  const page = search.page ?? 1;

  const query = useQuery({
    queryKey: ["jobs", search],
    queryFn: () => jobsApi.list({
      q: search.q, workMode: search.workMode, type: search.type,
      experienceLevel: search.level, minSalary: search.minSalary,
      sort: search.sort ?? "relevance", page, pageSize: 8,
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
    await jobsApi.toggleSave(id);
    qc.invalidateQueries({ queryKey: ["jobs"] });
  }

  const totalPages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Job explorer" description="Search, filter, and sort thousands of high-signal opportunities." />

      <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-6">
        <aside className="space-y-6">
          <FilterGroup label="Work mode">
            {WORK_MODES.map((m) => <Check key={m} label={m} checked={search.workMode?.includes(m) ?? false} onChange={() => toggle("workMode", m)} />)}
          </FilterGroup>
          <FilterGroup label="Type">
            {TYPES.map((t) => <Check key={t} label={t} checked={search.type?.includes(t) ?? false} onChange={() => toggle("type", t)} />)}
          </FilterGroup>
          <FilterGroup label="Experience">
            {LEVELS.map((l) => <Check key={l} label={l} checked={search.level?.includes(l) ?? false} onChange={() => toggle("level", l)} />)}
          </FilterGroup>
          <FilterGroup label="Min salary">
            <input
              type="number" step={10000} placeholder="e.g. 120000"
              className="w-full h-9 px-3 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent"
              value={search.minSalary ?? ""}
              onChange={(e) => update({ minSalary: e.target.value ? Number(e.target.value) : undefined })}
            />
          </FilterGroup>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search titles, companies, skills…"
                className="w-full h-10 pl-9 pr-3 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent"
                value={search.q ?? ""}
                onChange={(e) => update({ q: e.target.value || undefined })}
              />
            </div>
            <select
              value={search.sort ?? "relevance"}
              onChange={(e) => update({ sort: e.target.value as typeof search.sort })}
              className="h-10 px-3 rounded-md bg-background ring-1 ring-border text-sm outline-none focus:ring-2 focus:ring-accent"
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {query.isLoading ? <LoadingState /> :
            query.isError ? <ErrorState onRetry={() => query.refetch()} /> :
            query.data!.items.length === 0 ? <EmptyState title="No jobs match these filters" description="Try widening salary, location, or experience filters." /> :
            <>
              <div className="text-xs text-muted-foreground mb-3">{query.data!.total} results</div>
              <div className="space-y-4">
                {query.data!.items.map((j) => <JobCard key={j.id} job={j} onToggleSave={toggleSave} />)}
              </div>

              <div className="mt-8 flex items-center justify-between">
                <button
                  disabled={page <= 1}
                  onClick={() => navigate({ search: (p: typeof search) => ({ ...p, page: page - 1 }) })}
                  className="h-8 px-3 inline-flex items-center gap-1 rounded-md ring-1 ring-border text-sm disabled:opacity-40 hover:bg-surface"
                >
                  <ChevronLeft className="size-4" /> Prev
                </button>
                <span className="text-xs text-muted-foreground">Page {page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => navigate({ search: (p: typeof search) => ({ ...p, page: page + 1 }) })}
                  className="h-8 px-3 inline-flex items-center gap-1 rounded-md ring-1 ring-border text-sm disabled:opacity-40 hover:bg-surface"
                >
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </>
          }
        </div>
      </div>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="size-4 rounded ring-1 ring-border accent-accent" />
      <span className="capitalize">{label}</span>
    </label>
  );
}