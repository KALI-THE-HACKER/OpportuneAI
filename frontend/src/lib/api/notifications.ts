import { apiCall, getApiAuthToken } from "./client";
import type { NotificationItem } from "../mock/user";

export const notificationsApi = {
  async list(): Promise<NotificationItem[]> {
    return apiCall<NotificationItem[]>("/api/notifications");
  },
  async markRead(id: string): Promise<void> {
    await apiCall<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: "POST",
    });
  },
  async markAllRead(): Promise<void> {
    await apiCall<{ updated: number }>("/api/notifications/read-all", {
      method: "POST",
    });
  },
  stream(onMessage: () => void): () => void {
    const base = import.meta.env.VITE_API_URL || "";
    const token = getApiAuthToken();
    if (!token) return () => undefined;

    const controller = new AbortController();
    void (async () => {
      const response = await fetch(`${base}/api/notifications/stream`, {
        method: "GET",
        headers: { Authorization: `****** },
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          if (chunk.startsWith("data:")) onMessage();
        }
      }
    })().catch(() => undefined);

    return () => controller.abort();
  },
};
