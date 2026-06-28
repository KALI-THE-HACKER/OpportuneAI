import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/forgot-password")({
  component: () => <Navigate to="/auth/sign-in" replace />,
});
