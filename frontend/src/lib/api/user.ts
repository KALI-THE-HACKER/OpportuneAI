import { apiCall } from "./client";
import type { UserProfile } from "../mock/user";

export const userApi = {
  async get(): Promise<UserProfile> {
    return apiCall<UserProfile>("/api/auth/me");
  },
  async update(patch: Partial<UserProfile>): Promise<UserProfile> {
    return apiCall<UserProfile>("/api/users/me", {
      method: "PUT",
      body: JSON.stringify(patch),
    });
  },
};
