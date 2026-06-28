import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/layouts/app-layout";
import { LoadingState } from "@/components/shared/state-views";

export const Route = createFileRoute("/app")({
  component: AuthGate,
});

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) return <LoadingState label="Loading your workspace…" />;
  if (!isAuthenticated)
    return <Navigate to="/auth/sign-in" search={{ redirect: pathname }} replace />;
  return <AppLayout />;
}
