export interface Provider {
  id: string;
  name: string;
  status: "healthy" | "degraded" | "down";
  jobsToday: number;
  successRate: number;
  lastSyncAt: string;
}

export interface Worker {
  id: string;
  region: string;
  status: "active" | "idle" | "offline";
  cpu: number;
  memory: number;
  jobsProcessed: number;
}

export interface QueueItem {
  id: string;
  provider: string;
  type: string;
  attempts: number;
  status: "queued" | "processing" | "failed";
  enqueuedAt: string;
}

export interface SystemStats {
  totalJobs: number;
  totalUsers: number;
  jobsLast24h: number;
  applicationsLast24h: number;
  avgMatchScore: number;
  pipelineLatencyMs: number;
  uptimePct: number;
}

export const MOCK_PROVIDERS: Provider[] = [
  { id: "p1", name: "LinkedIn Raw", status: "healthy", jobsToday: 14_022, successRate: 99.4, lastSyncAt: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
  { id: "p2", name: "Greenhouse", status: "healthy", jobsToday: 6_412, successRate: 99.9, lastSyncAt: new Date(Date.now() - 1000 * 60 * 5).toISOString() },
  { id: "p3", name: "Lever", status: "degraded", jobsToday: 1_834, successRate: 92.1, lastSyncAt: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
  { id: "p4", name: "Workday", status: "healthy", jobsToday: 8_205, successRate: 98.6, lastSyncAt: new Date(Date.now() - 1000 * 60 * 3).toISOString() },
  { id: "p5", name: "Internal Crawler", status: "down", jobsToday: 0, successRate: 0, lastSyncAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() }
];

export const MOCK_WORKERS: Worker[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `w-${i + 1}`,
  region: ["us-east-1","eu-west-1","ap-south-1","us-west-2"][i % 4],
  status: i === 4 ? "idle" : i === 9 ? "offline" : "active",
  cpu: 20 + ((i * 11) % 70),
  memory: 30 + ((i * 7) % 60),
  jobsProcessed: 1000 + i * 187
}));

export const MOCK_QUEUE: QueueItem[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `q-${i + 1}`,
  provider: MOCK_PROVIDERS[i % MOCK_PROVIDERS.length].name,
  type: ["fetch","parse","embed","match"][i % 4],
  attempts: (i % 3) + 1,
  status: i === 6 ? "failed" : i < 3 ? "processing" : "queued",
  enqueuedAt: new Date(Date.now() - i * 60_000).toISOString()
}));

export const MOCK_STATS: SystemStats = {
  totalJobs: 142_408,
  totalUsers: 8_412,
  jobsLast24h: 30_473,
  applicationsLast24h: 1_204,
  avgMatchScore: 78.4,
  pipelineLatencyMs: 42,
  uptimePct: 99.97
};