import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { LoadingState } from "@/components/shared/state-views";
import { z } from "zod";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth/callback")({
  validateSearch: searchSchema,
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/callback" });

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        void navigate({ to: search.redirect ?? "/app/dashboard", replace: true });
      } else {
        void navigate({ to: "/auth/sign-in", replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate, search.redirect]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <LoadingState label="Finalizing your secure session…" />
    </div>
  );
}
