import { apiCall, type Paginated } from "./client";
import {
  type Job,
  type ApplicationRecord,
  MOCK_APPLICATIONS,
  APPLIED_JOB_IDS,
  SAVED_JOB_IDS,
} from "../mock/jobs";

export interface FeedParams {
  limit?: number;
  cursor?: string;
}

export interface FeedResponse {
  items: Job[];
  next_cursor?: string | null;
  total: number;
}

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

export type JobWithDbId = Job & { dbId?: number };

const savedSet = new Set(SAVED_JOB_IDS);

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

export const jobsApi = {
  /**
   * Fetch the personalized feed with cursor pagination from the backend.
   */
  async feed(params: FeedParams = {}): Promise<FeedResponse> {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.cursor) query.set("cursor", params.cursor);

    const queryString = query.toString();
    const path = `/api/feed${queryString ? `?${queryString}` : ""}`;
    const res = await apiCall<FeedResponse>(path);
    return {
      items: res.items.map((j) => {
        const parsedId = Number(j.id.replace(/^job-/, ""));
        return {
          ...j,
          dbId: !isNaN(parsedId) ? parsedId : undefined,
          saved: savedSet.has(j.id),
        };
      }),
      next_cursor: res.next_cursor,
      total: res.total,
    };
  },

  /**
   * Retrieve a single job by its ID.
   */
  async get(id: string): Promise<JobWithDbId | null> {
    try {
      const res = await apiCall<Job>(`/api/jobs/${id}`);
      const parsedId = Number(res.id.replace(/^job-/, ""));
      return {
        ...res,
        dbId: !isNaN(parsedId) ? parsedId : undefined,
        saved: savedSet.has(res.id),
      };
    } catch {
      return null;
    }
  },

  /**
   * Top recommendations from the personalized feed.
   */
  async recommendations(limit = 6): Promise<JobWithDbId[]> {
    const res = await this.feed({ limit });
    return res.items;
  },

  /**
   * List jobs with search, filtering, and pagination over feed results.
   */
  async list(query: JobsQuery = {}): Promise<Paginated<JobWithDbId>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    // Fetch batch from feed to populate explorer view
    const feedRes = await this.feed({ limit: 100 });
    const filtered = applyFilters(feedRes.items, query);
    const start = (page - 1) * pageSize;

    return {
      items: filtered
        .slice(start, start + pageSize)
        .map((j) => ({ ...j, saved: savedSet.has(j.id) })),
      total: filtered.length,
      page,
      pageSize,
    };
  },

  async saved(): Promise<JobWithDbId[]> {
    const feedRes = await this.feed({ limit: 100 });
    return feedRes.items.filter((j) => savedSet.has(j.id));
  },

  async toggleSave(id: string, source = "feed"): Promise<boolean> {
    const isNowSaved = !savedSet.has(id);
    if (isNowSaved) {
      savedSet.add(id);
    } else {
      savedSet.delete(id);
    }

    // Send user event to record interaction & invalidate feed
    try {
      const numId = parseInt(id.replace("job-", ""), 10);
      if (!isNaN(numId)) {
        await apiCall("/api/v1/events/jobs", {
          method: "POST",
          body: JSON.stringify({
            job_id: numId,
            event_type: isNowSaved ? "save" : "unsave",
            source,
          }),
        });
      }
    } catch {
      // Ignore background event delivery errors
    }

    return isNowSaved;
  },

  async applications(): Promise<(ApplicationRecord & { job: JobWithDbId })[]> {
    const feedRes = await this.feed({ limit: 50 });
    const jobMap = new Map(feedRes.items.map((j) => [j.id, j]));

    return MOCK_APPLICATIONS.map((a) => ({
      ...a,
      job: (jobMap.get(a.jobId) || feedRes.items[0]) as JobWithDbId,
    })).filter((a) => Boolean(a.job));
  },

  async apply(jobId: string, source = "job_detail"): Promise<ApplicationRecord> {
    const rec: ApplicationRecord = {
      id: "app-" + Math.random().toString(36).slice(2, 7),
      jobId,
      status: "applied",
      appliedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };
    if (!APPLIED_JOB_IDS.includes(jobId)) APPLIED_JOB_IDS.push(jobId);

    // Send user event to record interaction & invalidate feed
    try {
      const numId = parseInt(jobId.replace("job-", ""), 10);
      if (!isNaN(numId)) {
        await apiCall("/api/v1/events/jobs", {
          method: "POST",
          body: JSON.stringify({
            job_id: numId,
            event_type: "apply",
            source,
          }),
        });
      }
    } catch {
      // Ignore background event delivery errors
    }

    return rec;
  },
};
