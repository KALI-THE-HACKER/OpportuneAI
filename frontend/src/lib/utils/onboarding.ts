import type { UserProfile } from "@/lib/mock/user";

/**
 * Checks if a user profile is incomplete.
 * Profile is considered incomplete if neither a target job title nor preferred roles are set.
 */
export function isProfileIncomplete(user: UserProfile | null | undefined): boolean {
  if (!user) return true;
  const hasTitle = Boolean(user.title && user.title.trim().length > 0);
  const hasRoles = Boolean(user.preferredRoles && user.preferredRoles.length > 0);
  return !hasTitle && !hasRoles;
}

/**
 * Checks if a user has not yet provided/uploaded a resume.
 * Returns false if resume exists, is processing/processed, or user explicitly skipped.
 */
export function isResumeIncomplete(user: UserProfile | null | undefined): boolean {
  if (!user) return true;

  if (typeof window !== "undefined") {
    const skipped = sessionStorage.getItem("onboarding_resume_skipped");
    if (skipped === "true") return false;
  }

  if (user.hasResume) return false;
  if (user.resumeFileName && user.resumeFileName.trim().length > 0) return false;
  if (user.resumeStatus && user.resumeStatus !== "failed") return false;

  return true;
}
