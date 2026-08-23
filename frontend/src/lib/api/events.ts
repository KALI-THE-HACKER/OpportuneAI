import { apiCall } from "./client";

export type JobEventType =
  "impression" | "click" | "view" | "save" | "unsave" | "apply" | "dismiss" | "not_interested";

export type JobEventSource =
  "feed" | "search" | "job_detail" | "recommendation" | "notification" | "other";

export interface RecordEventOptions {
  jobId: number;
  eventType: JobEventType;
  source: JobEventSource;
  position?: number;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface EventReceipt {
  id: number;
  event_type: string;
  created_at: string;
}

/**
 * Record a user–job interaction event.
 *
 * Fire-and-forget safe: failures are logged but never thrown to callers
 * so event tracking never breaks the UX flow.
 */
export async function recordEvent(opts: RecordEventOptions): Promise<void> {
  try {
    await apiCall<EventReceipt>("/api/v1/events/jobs", {
      method: "POST",
      body: JSON.stringify({
        job_id: opts.jobId,
        event_type: opts.eventType,
        source: opts.source,
        position: opts.position,
        session_id: opts.sessionId,
        metadata: opts.metadata,
      }),
    });
  } catch (err) {
    // Events are best-effort — never surface tracking errors to users
    console.warn("[events] failed to record event", opts.eventType, err);
  }
}
