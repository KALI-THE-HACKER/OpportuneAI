import { delay } from "./client";
import { MOCK_NOTIFICATIONS, type NotificationItem } from "../mock/user";

let items = [...MOCK_NOTIFICATIONS];

export const notificationsApi = {
  async list(): Promise<NotificationItem[]> {
    return delay(items);
  },
  async markRead(id: string): Promise<void> {
    items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    return delay(undefined, 100);
  },
  async markAllRead(): Promise<void> {
    items = items.map((n) => ({ ...n, read: true }));
    return delay(undefined, 150);
  },
};
