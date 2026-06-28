import { delay } from "./client";
import { MOCK_RESUME, type ResumeData } from "../mock/user";

let current: ResumeData | null = MOCK_RESUME;

export const resumeApi = {
  async get(): Promise<ResumeData | null> {
    return delay(current);
  },
  async upload(file: { name: string; sizeKb: number }): Promise<ResumeData> {
    current = {
      ...MOCK_RESUME,
      fileName: file.name,
      sizeKb: file.sizeKb,
      uploadedAt: new Date().toISOString(),
      status: "processed",
    };
    return delay(current, 1200);
  },
  async remove(): Promise<void> {
    current = null;
    return delay(undefined, 300);
  },
};