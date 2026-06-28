import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/reset-password")({
  component: () => <Navigate to="/auth/sign-in" replace />,
});
