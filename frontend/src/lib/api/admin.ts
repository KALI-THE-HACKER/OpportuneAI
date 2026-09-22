import { apiCall } from "./client";

export interface SystemStats {
  totalJobs: number;
  totalUsers: number;
  jobsLast24h: number;
  applicationsLast24h: number;
  avgMatchScore: number;
  pipelineLatencyMs: number;
  uptimePct: number;
  activeWorkers: number;
  queuedJobs: number;
  failedJobs: number;
}

export interface ScraperHealth {
  provider: string;
  name: string;
  status: "healthy" | "running" | "degraded" | "blocked" | "failed" | "idle";
  is_running: boolean;
  total_jobs_indexed: number;
  success_rate: number;
  avg_duration_ms: number;
  last_run_at: string | null;
  last_run_status: string;
  last_error: string | null;
  next_scheduled_run_at: string;
  next_retry_at: string | null;
  total_runs_count: number;
}

export interface ScraperRunItem {
  id: number;
  provider: string;
  trigger_type: string;
  status: "queued" | "running" | "completed" | "failed" | "retrying" | "cancelled";
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  items_fetched: number;
  items_saved: number;
  error_message: string | null;
  retry_count: number;
  next_retry_at: string | null;
  triggered_by_email: string | null;
  logs_count: number;
}

export interface ScraperRunDetail extends ScraperRunItem {
  stack_trace: string | null;
  max_retries: number;
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

export interface QueueTelemetry {
  total_queued: number;
  total_failed: number;
  active_workers_count: number;
  queues: Array<{
    name: string;
    queued_jobs: number;
    failed_jobs: number;
    is_empty: boolean;
  }>;
  workers: Array<{
    id: string;
    name: string;
    state: string;
    queues: string[];
    current_job_id: string | null;
    birth_date: string | null;
    successful_job_count: number;
    failed_job_count: number;
  }>;
}

export interface LogItem {
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "CRITICAL" | "DEBUG";
  logger: string;
  message: string;
  formatted?: string;
}

export interface ConfigCategory {
  category: string;
  description: string;
  value: any;
  updated_at: string | null;
  updated_by_email: string | null;
}

export interface SystemApiKeyItem {
  id: number;
  provider: string;
  label: string;
  masked_key: string;
  is_active: boolean;
  usage_count: number;
  last_used_at: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  user_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  changes: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export const adminApi = {
  async stats(): Promise<SystemStats> {
    return apiCall<SystemStats>("/api/admin/stats");
  },

  async scrapers(): Promise<ScraperHealth[]> {
    return apiCall<ScraperHealth[]>("/api/admin/scrapers");
  },

  async triggerScraper(provider: string = "all"): Promise<{ success: boolean; message: string; run_ids: number[] }> {
    return apiCall("/api/admin/scrapers/trigger", {
      method: "POST",
      body: JSON.stringify({ provider }),
    });
  },

  async cancelScraperRun(runId: number): Promise<{ success: boolean; message: string }> {
    return apiCall(`/api/admin/scrapers/cancel/${runId}`, {
      method: "POST",
    });
  },

  async retryScraperRun(runId: number): Promise<{ success: boolean; message: string; new_run_ids: number[] }> {
    return apiCall(`/api/admin/scrapers/retry/${runId}`, {
      method: "POST",
    });
  },

  async scraperRuns(params?: {
    provider?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResult<ScraperRunItem>> {
    const q = new URLSearchParams();
    if (params?.provider) q.set("provider", params.provider);
    if (params?.status) q.set("status_filter", params.status);
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("page_size", String(params.pageSize));
    const qs = q.toString();
    return apiCall(`/api/admin/scrapers/runs${qs ? `?${qs}` : ""}`);
  },

  async scraperRunDetails(runId: number): Promise<ScraperRunDetail> {
    return apiCall(`/api/admin/scrapers/runs/${runId}`);
  },

  async queue(): Promise<QueueTelemetry> {
    return apiCall<QueueTelemetry>("/api/admin/queue");
  },

  async retryFailedQueue(queueName?: string): Promise<{ success: boolean; retried_count: number; message: string }> {
    const url = `/api/admin/queue/retry-failed${queueName ? `?queue_name=${encodeURIComponent(queueName)}` : ""}`;
    return apiCall(url, { method: "POST" });
  },

  async clearFailedQueue(queueName?: string): Promise<{ success: boolean; cleared_count: number; message: string }> {
    const url = `/api/admin/queue/clear-failed${queueName ? `?queue_name=${encodeURIComponent(queueName)}` : ""}`;
    return apiCall(url, { method: "POST" });
  },

  async logs(params?: {
    source?: string;
    level?: string;
    search?: string;
    limit?: number;
  }): Promise<LogItem[]> {
    const q = new URLSearchParams();
    if (params?.source) q.set("source", params.source);
    if (params?.level) q.set("level", params.level);
    if (params?.search) q.set("search", params.search);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return apiCall(`/api/admin/logs${qs ? `?${qs}` : ""}`);
  },

  async configs(): Promise<Record<string, ConfigCategory>> {
    return apiCall("/api/admin/config");
  },

  async updateConfig(payload: {
    key: string;
    value: any;
    is_secret?: boolean;
  }): Promise<{ success: boolean; key: string; message: string }> {
    return apiCall("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async apiKeys(): Promise<SystemApiKeyItem[]> {
    return apiCall("/api/admin/api-keys");
  },

  async createApiKey(payload: {
    provider: string;
    label: string;
    secret_key: string;
  }): Promise<{ success: boolean; id: number; label: string; masked_key: string; message: string }> {
    return apiCall("/api/admin/api-keys", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteApiKey(keyId: number): Promise<{ success: boolean; message: string }> {
    return apiCall(`/api/admin/api-keys/${keyId}`, {
      method: "DELETE",
    });
  },

  async sendTestNotification(payload?: {
    title?: string;
    message?: string;
    severity?: string;
  }): Promise<{ success: boolean; delivered: boolean; message: string }> {
    return apiCall("/api/admin/notifications/test", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async auditLogs(params?: {
    page?: number;
    pageSize?: number;
    action?: string;
  }): Promise<PaginatedResult<AuditLogItem>> {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.pageSize) q.set("page_size", String(params.pageSize));
    if (params?.action) q.set("action_filter", params.action);
    const qs = q.toString();
    return apiCall(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
