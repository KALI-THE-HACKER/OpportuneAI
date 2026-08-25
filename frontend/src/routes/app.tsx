import { useEffect } from "react";
import { createFileRoute, Navigate, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { userApi } from "@/lib/api/user";
import { AppLayout, AppLayoutLoading } from "@/components/layouts/app-layout";
import { isProfileIncomplete, isResumeIncomplete } from "@/lib/utils/onboarding";

export const Route = createFileRoute("/app")({
  component: AuthGate,
});

function AuthGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const userQuery = useQuery({
    queryKey: ["user"],
    queryFn: () => userApi.get(),
    enabled: isAuthenticated && !isLoading,
    staleTime: 1000 * 30,
  });

  const currentUser = userQuery.data ?? user;
  const isFetchingUser = isLoading || (isAuthenticated && userQuery.isLoading && !user);

  useEffect(() => {
    if (!isFetchingUser && isAuthenticated && currentUser) {
      const profileIncomplete = isProfileIncomplete(currentUser);
      const resumeIncomplete = isResumeIncomplete(currentUser);

      // 1. If profile is incomplete, route to profile page
      if (profileIncomplete) {
        if (pathname !== "/app/profile") {
          void navigate({ to: "/app/profile", search: { onboarding: "true" }, replace: true });
        }
        return;
      }

      // 2. If profile is complete, but resume is incomplete:
      // Only route if user is on a main dashboard/feature page and not already viewing resume/profile
      if (resumeIncomplete) {
        if (pathname !== "/app/resume" && pathname !== "/app/profile") {
          void navigate({ to: "/app/resume", search: { onboarding: "true" }, replace: true });
        }
        return;
      }

      // 3. Both profile and resume are completed:
      // Allow user to remain on requested destination page.
    }
  }, [currentUser, isAuthenticated, isFetchingUser, pathname, navigate]);

  if (isFetchingUser || (isAuthenticated && !currentUser)) return <AppLayoutLoading />;
  if (!isAuthenticated)
    return <Navigate to="/auth/sign-in" search={{ redirect: pathname }} replace />;
  return <AppLayout />;
}

