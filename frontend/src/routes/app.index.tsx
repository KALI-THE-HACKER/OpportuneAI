import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/app/")({
  component: () => <Navigate to="/app/dashboard" replace />,
});
