import { delay, type Paginated } from "./client";
import {
  MOCK_JOBS,
  type Job,
  MOCK_APPLICATIONS,
  type ApplicationRecord,
  APPLIED_JOB_IDS,
  SAVED_JOB_IDS,
} from "../mock/jobs";

export interface JobsQuery {
  q?: string;
  workMode?: string[];
  type?: string[];
  experienceLevel?: string[];
  minSalary?: number;
  sort?: "relevance" | "recent" | "salary-high" | "salary-low";
  page?: number;
  pageSize?: number;
}

function applyFilters(jobs: Job[], q: JobsQuery): Job[] {
  let out = [...jobs];
  if (q.q) {
    const term = q.q.toLowerCase();
    out = out.filter(
      (j) =>
        j.title.toLowerCase().includes(term) ||
        j.company.toLowerCase().includes(term) ||
        j.skills.some((s) => s.toLowerCase().includes(term)),
    );
  }
  if (q.workMode?.length) out = out.filter((j) => q.workMode!.includes(j.workMode));
  if (q.type?.length) out = out.filter((j) => q.type!.includes(j.type));
  if (q.experienceLevel?.length)
    out = out.filter((j) => q.experienceLevel!.includes(j.experienceLevel));
  if (q.minSalary) out = out.filter((j) => j.salaryMax >= q.minSalary!);
  switch (q.sort) {
    case "recent":
      out.sort((a, b) => +new Date(b.postedAt) - +new Date(a.postedAt));
      break;
    case "salary-high":
      out.sort((a, b) => b.salaryMax - a.salaryMax);
      break;
    case "salary-low":
      out.sort((a, b) => a.salaryMin - b.salaryMin);
      break;
    default:
      out.sort((a, b) => b.matchScore - a.matchScore);
  }
  return out;
}

const savedSet = new Set(SAVED_JOB_IDS);

export const jobsApi = {
  async list(query: JobsQuery = {}): Promise<Paginated<Job>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const filtered = applyFilters(MOCK_JOBS, query);
    const start = (page - 1) * pageSize;
    return delay({
      items: filtered
        .slice(start, start + pageSize)
        .map((j) => ({ ...j, saved: savedSet.has(j.id) })),
      total: filtered.length,
      page,
      pageSize,
    });
  },
  async get(id: string): Promise<Job | null> {
    const job = MOCK_JOBS.find((j) => j.id === id) ?? null;
    return delay(job ? { ...job, saved: savedSet.has(job.id) } : null);
  },
  async recommendations(limit = 6): Promise<Job[]> {
    return delay(
      [...MOCK_JOBS]
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit)
        .map((j) => ({ ...j, saved: savedSet.has(j.id) })),
    );
  },
  async saved(): Promise<Job[]> {
    return delay(MOCK_JOBS.filter((j) => savedSet.has(j.id)).map((j) => ({ ...j, saved: true })));
  },
  async toggleSave(id: string): Promise<boolean> {
    if (savedSet.has(id)) savedSet.delete(id);
    else savedSet.add(id);
    return delay(savedSet.has(id), 150);
  },
  async applications(): Promise<(ApplicationRecord & { job: Job })[]> {
    return delay(
      MOCK_APPLICATIONS.map((a) => ({
        ...a,
        job: MOCK_JOBS.find((j) => j.id === a.jobId)!,
      })),
    );
  },
  async apply(jobId: string): Promise<ApplicationRecord> {
    const rec: ApplicationRecord = {
      id: "app-" + Math.random().toString(36).slice(2, 7),
      jobId,
      status: "applied",
      appliedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };
    if (!APPLIED_JOB_IDS.includes(jobId)) APPLIED_JOB_IDS.push(jobId);
    return delay(rec, 400);
  },
};
