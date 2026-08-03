import { ApiError, apiCall } from "./client";

export interface ResumeData {
  fileName: string;
  uploadedAt: string;
  sizeKb: number;
  status: "processed" | "processing" | "failed";
  extractedSkills: string[];
  experienceLevel: string;
  yearsTotal: number;
  confidence: number;
}

export const resumeApi = {
  async get(): Promise<ResumeData | null> {
    try {
      return await apiCall<ResumeData>("/api/resume");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
  async upload(file: File): Promise<ResumeData> {
    console.log("[resumeApi] Uploading resume to /api/resume/upload:", file.name, file.size);
    const formData = new FormData();
    formData.append("file", file);
    return apiCall<ResumeData>("/api/resume/upload", {
      method: "POST",
      body: formData,
    });
  },
  async remove(): Promise<void> {
    await apiCall<void>("/api/resume", { method: "DELETE" });
  },
  async getDownloadUrl(): Promise<{ downloadUrl: string }> {
    return apiCall<{ downloadUrl: string }>("/api/resume/download");
  },
};
