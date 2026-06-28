import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AuthShell, FormField, inputClass, primaryButtonClass } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in · OpportuneAI" }, { name: "description", content: "Sign in to your OpportuneAI account." }] }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/sign-in" });
  const [email, setEmail] = useState("alex@example.com");
  const [password, setPassword] = useState("demopassword");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) {
    navigate({ to: search.redirect ?? "/app/dashboard", replace: true });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate({ to: search.redirect ?? "/app/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue your search."
      footer={<>Don't have an account? <Link to="/auth/sign-up" className="text-foreground font-medium hover:text-accent">Create one</Link></>}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        <div className="flex justify-end -mt-1">
          <Link to="/auth/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Forgot password?</Link>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className={primaryButtonClass}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="mt-4 text-[11px] text-muted-foreground text-center">Demo mode — any email and 6+ char password works.</p>
    </AuthShell>
  );
}