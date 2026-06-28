import { delay } from "./client";
import { MOCK_USER, type UserProfile } from "../mock/user";

let profile: UserProfile = { ...MOCK_USER };

export const userApi = {
  async get(): Promise<UserProfile> {
    return delay(profile);
  },
  async update(patch: Partial<UserProfile>): Promise<UserProfile> {
    profile = { ...profile, ...patch };
    return delay(profile, 400);
  },
};