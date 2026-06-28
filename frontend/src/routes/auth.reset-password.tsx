import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthShell, FormField, inputClass, primaryButtonClass } from "@/components/auth/auth-shell";
import { authApi } from "@/lib/api";

const searchSchema = z.object({ token: z.string().optional() });

export const Route = createFileRoute("/auth/reset-password")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Set new password · OpportuneAI" }, { name: "description", content: "Set a new password for your account." }] }),
  component: ResetPage,
});

function ResetPage() {
  const search = useSearch({ from: "/auth/reset-password" });
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) return setError("Passwords do not match");
    setBusy(true);
    try {
      await authApi.resetPassword(search.token ?? "demo-token", password);
      navigate({ to: "/auth/sign-in", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Set a new password" description="Choose a password you haven't used before.">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="New password" htmlFor="password">
          <input id="password" type="password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <FormField label="Confirm password" htmlFor="confirm">
          <input id="confirm" type="password" required className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </FormField>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Updating…" : "Update password"}</button>
        <div className="text-xs text-center text-muted-foreground"><Link to="/auth/sign-in" className="hover:text-foreground">Back to sign in</Link></div>
      </form>
    </AuthShell>
  );
}