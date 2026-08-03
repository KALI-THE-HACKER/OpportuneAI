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
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

// Global authentication token variable set by the auth hook
let authToken: string | null = null;

export function setApiAuthToken(token: string | null) {
  authToken = token;
}

// Local development (including a local production preview) runs FastAPI on
// port 8000. Deployments must set VITE_API_URL to their public API origin.
// Using an empty production fallback would send `/api/*` back to the frontend
// server, so the backend would never see an upload request.
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401) {
        setApiAuthToken(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("opportune.session");
        }
      }
      let message = "API request failed";
      try {
        const errorData = await response.json();
        const rawDetail = errorData.detail || errorData.message || message;
        if (typeof rawDetail === "object" && rawDetail !== null) {
          message = rawDetail.message || rawDetail.error || JSON.stringify(rawDetail);
        } else {
          message = String(rawDetail);
        }
      } catch {
        try {
          message = await response.text();
        } catch {
          // Ignore failures, fall back to default message
        }
      }
      throw new ApiError(response.status, message);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as T;
    }
    return {} as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, error instanceof Error ? error.message : "Network error");
  }
}
