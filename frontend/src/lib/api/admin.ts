import { delay } from "./client";
import { MOCK_PROVIDERS, MOCK_WORKERS, MOCK_QUEUE, MOCK_STATS } from "../mock/admin";

export const adminApi = {
  async stats() {
    return delay(MOCK_STATS);
  },
  async providers() {
    return delay(MOCK_PROVIDERS);
  },
  async workers() {
    return delay(MOCK_WORKERS);
  },
  async queue() {
    return delay(MOCK_QUEUE);
  },
};
