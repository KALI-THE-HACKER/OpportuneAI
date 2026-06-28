import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, FormField, inputClass, primaryButtonClass } from "@/components/auth/auth-shell";
import { authApi } from "@/lib/api";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password · OpportuneAI" }, { name: "description", content: "Reset your OpportuneAI password." }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authApi.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      description="We'll send a reset link to your inbox."
      footer={<><Link to="/auth/sign-in" className="text-foreground font-medium hover:text-accent">Back to sign in</Link></>}
    >
      {sent ? (
        <div className="p-4 rounded-md ring-1 ring-border bg-card text-sm">
          Check <span className="font-medium">{email}</span> for a reset link. The link expires in 30 minutes.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Email" htmlFor="email">
            <input id="email" type="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Sending…" : "Send reset link"}</button>
        </form>
      )}
    </AuthShell>
  );
}