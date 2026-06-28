import { useEffect } from "react";
import { createFileRoute, Navigate, useRouterState, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout, AppLayoutLoading } from "@/components/layouts/app-layout";

export const Route = createFileRoute("/app")({
  component: AuthGate,
});

function AuthGate() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      // Check if profile is empty (typical of first login)
      const isProfileIncomplete = !user.title && (!user.preferredRoles || user.preferredRoles.length === 0);
      const sessionRedirected = sessionStorage.getItem("onboarding_redirected") === "true";

      // If they just logged in and profile is empty, redirect to profile with onboarding flag
      if (
        isProfileIncomplete &&
        !sessionRedirected &&
        pathname !== "/app/profile" &&
        pathname !== "/app/resume"
      ) {
        sessionStorage.setItem("onboarding_redirected", "true");
        void navigate({ to: "/app/profile", search: { onboarding: "true" }, replace: true });
      }
    }
  }, [user, isAuthenticated, isLoading, pathname, navigate]);

  if (isLoading) return <AppLayoutLoading />;
  if (!isAuthenticated)
    return <Navigate to="/auth/sign-in" search={{ redirect: pathname }} replace />;
  return <AppLayout />;
}
