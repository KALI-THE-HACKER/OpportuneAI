import { apiCall } from "./client";
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
};

