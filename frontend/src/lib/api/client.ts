/**
 * Centralized API client. Today it returns mock data with simulated latency.
 * Swap the implementations in src/lib/api/*.ts for real fetch() calls when
 * the backend is ready — call sites and signatures stay identical.
 */
export const API_LATENCY_MS = 350;

export function delay<T>(value: T, ms = API_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};