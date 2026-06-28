import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/verify-email")({
  component: () => <Navigate to="/auth/sign-in" replace />,
});
