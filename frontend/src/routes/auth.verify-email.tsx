import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell, primaryButtonClass } from "@/components/auth/auth-shell";
import { authApi } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth/verify-email")({
  head: () => ({ meta: [{ title: "Verify email · OpportuneAI" }, { name: "description", content: "Verify your email to continue." }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function simulate() {
    setBusy(true);
    await authApi.verifyEmail("demo-token");
    refresh();
    navigate({ to: "/app/dashboard", replace: true });
  }
  async function resend() {
    await authApi.resendVerification();
    setSent(true);
  }

  return (
    <AuthShell
      title="Verify your email"
      description={`We sent a verification link to ${user?.email ?? "your inbox"}. Click it to activate your account.`}
      footer={<Link to="/auth/sign-in" className="hover:text-foreground">Back to sign in</Link>}
    >
      <div className="space-y-3">
        <button onClick={simulate} disabled={busy} className={primaryButtonClass}>{busy ? "Verifying…" : "I've verified — continue"}</button>
        <button onClick={resend} className="w-full h-10 inline-flex items-center justify-center rounded-md ring-1 ring-border text-sm hover:bg-surface">{sent ? "Sent ✓" : "Resend verification email"}</button>
      </div>
    </AuthShell>
  );
}