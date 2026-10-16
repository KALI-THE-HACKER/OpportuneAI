import { apiCall, type Paginated } from "./client";
import {
  type Job,
  type ApplicationRecord,
  type ApplicationStatus,
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
   * Automatically excludes jobs that the user has already applied to.
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
          saved: Boolean(j.saved),
          applied: Boolean(j.applied),
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
        saved: Boolean(res.saved),
        applied: Boolean(res.applied),
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
      items: filtered.slice(start, start + pageSize).map((j) => ({
        ...j,
        saved: Boolean(j.saved),
        applied: Boolean(j.applied),
      })),
      total: filtered.length,
      page,
      pageSize,
    };
  },

  async saved(): Promise<JobWithDbId[]> {
    const res = await apiCall<Job[]>("/api/saved");
    return res.map((j) => ({
      ...j,
      dbId: Number(j.id.replace(/^job-/, "")) || undefined,
      saved: true,
      applied: Boolean(j.applied),
    }));
  },

  async toggleSave(id: string, source = "feed"): Promise<boolean> {
    const res = await apiCall<{ saved: boolean }>(`/api/saved/${id}`, {
      method: "POST",
    });
    const numId = parseInt(id.replace("job-", ""), 10);
    if (!isNaN(numId)) {
      await apiCall("/api/v1/events/jobs", {
        method: "POST",
        body: JSON.stringify({
          job_id: numId,
          event_type: res.saved ? "save" : "unsave",
          source,
        }),
      }).catch(() => undefined);
    }
    return res.saved;
  },

  async applications(status?: string): Promise<(ApplicationRecord & { job: JobWithDbId })[]> {
    const url = status
      ? `/api/applications?status=${encodeURIComponent(status)}`
      : "/api/applications";
    const res = await apiCall<
      {
        id: string;
        jobId: string;
        status: ApplicationStatus;
        appliedAt: string;
        lastUpdate: string;
        notes?: string | null;
        job: Job;
      }[]
    >(url);

    return res.map((a) => {
      const parsedId = Number(a.job.id.replace(/^job-/, ""));
      return {
        id: a.id,
        jobId: a.jobId,
        status: a.status,
        appliedAt: a.appliedAt,
        lastUpdate: a.lastUpdate,
        notes: a.notes ?? undefined,
        job: {
          ...a.job,
          dbId: !isNaN(parsedId) ? parsedId : undefined,
          applied: true,
          saved: Boolean(a.job.saved),
        },
      };
    });
  },

  async apply(jobId: string, source = "job_detail"): Promise<ApplicationRecord> {
    const res = await apiCall<ApplicationRecord>("/api/applications", {
      method: "POST",
      body: JSON.stringify({
        job_id: jobId,
        status: "applied",
      }),
    });

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

    return res;
  },

  async updateApplication(
    applicationId: string,
    updates: { status?: ApplicationStatus; notes?: string },
  ): Promise<ApplicationRecord> {
    return apiCall<ApplicationRecord>(`/api/applications/${applicationId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  },

  async deleteApplication(applicationId: string): Promise<void> {
    await apiCall<void>(`/api/applications/${applicationId}`, {
      method: "DELETE",
    });
  },

  async generateOutreach(
    jobId: string,
    contactName?: string | null,
    contactRole?: string | null,
  ): Promise<{ subject: string; body: string }> {
    return apiCall<{ subject: string; body: string }>("/api/outreach/generate", {
      method: "POST",
      body: JSON.stringify({
        job_id: jobId,
        contact_name: contactName || undefined,
        contact_role: contactRole || undefined,
      }),
    });
  },
};
