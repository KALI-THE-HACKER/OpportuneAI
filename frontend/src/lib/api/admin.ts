import { apiCall } from "./client";
import {
  MOCK_PROVIDERS,
  MOCK_WORKERS,
  MOCK_QUEUE,
  MOCK_STATS,
  type SystemStats,
  type Provider,
  type Worker,
  type QueueItem,
} from "../mock/admin";

export const adminApi = {
  async stats(): Promise<SystemStats> {
    try {
      return await apiCall<SystemStats>("/api/admin/stats");
    } catch {
      return MOCK_STATS;
    }
  },
  async providers(): Promise<Provider[]> {
    try {
      return await apiCall<Provider[]>("/api/admin/providers");
    } catch {
      return MOCK_PROVIDERS;
    }
  },
  async workers(): Promise<Worker[]> {
    try {
      return await apiCall<Worker[]>("/api/admin/workers");
    } catch {
      return MOCK_WORKERS;
    }
  },
  async queue(): Promise<QueueItem[]> {
    try {
      return await apiCall<QueueItem[]>("/api/admin/queue");
    } catch {
      return MOCK_QUEUE;
    }
  },
};
