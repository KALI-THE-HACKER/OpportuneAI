import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, FormField, inputClass, primaryButtonClass } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({ meta: [{ title: "Create account · OpportuneAI" }, { name: "description", content: "Create your OpportuneAI account." }] }),
  component: SignUpPage,
});

function SignUpPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Please enter your name");
    setBusy(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      navigate({ to: "/auth/verify-email", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Build your AI profile in under a minute."
      footer={<>Already have an account? <Link to="/auth/sign-in" className="text-foreground font-medium hover:text-accent">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Full name" htmlFor="name">
          <input id="name" required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <input id="password" type="password" autoComplete="new-password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Creating account…" : "Create account"}</button>
      </form>
    </AuthShell>
  );
}