import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { AuthShell, FormField, inputClass, primaryButtonClass } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/lib/api/auth";
import { Github, Linkedin, AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth/sign-in")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in · OpportuneAI" },
      { name: "description", content: "Sign in to your OpportuneAI account." },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { signIn, signInWithSocial, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/sign-in" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void navigate({ to: search.redirect ?? "/app/dashboard", replace: true });
    }
  }, [isAuthenticated, navigate, search.redirect]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResendStatus(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate({ to: search.redirect ?? "/app/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!email.trim()) return;
    setResending(true);
    setResendStatus(null);
    try {
      const res = await authApi.resendVerification(email.trim());
      setResendStatus(res.message || "Verification email sent. Check your inbox.");
    } catch {
      setResendStatus("Failed to send verification email. Try again later.");
    } finally {
      setResending(false);
    }
  }

  async function handleSocialSignIn(provider: "google-oauth2" | "github" | "linkedin") {
    setError(null);
    setResendStatus(null);
    setBusy(true);
    try {
      await signInWithSocial(provider);
      navigate({ to: search.redirect ?? "/app/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Sign in with ${provider} failed`);
    } finally {
      setBusy(false);
    }
  }

  const isUnverifiedError = error && error.toLowerCase().includes("verify your email");

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to access your OpportuneAI dashboard."
      footer={
        <>
          Don't have an account?{" "}
          <Link
            to="/auth/sign-up"
            className="font-semibold text-foreground hover:text-accent transition-colors"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </FormField>
        <FormField label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </FormField>

        {error && (
          <div className="space-y-2 p-3 rounded-lg border border-destructive/20 bg-destructive/8 animate-in fade-in slide-in-from-top-1 duration-250">
            <div className="flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            {isUnverifiedError && (
              <div className="pt-1.5 border-t border-destructive/15 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">Didn't receive verification email?</span>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  {resending ? <RefreshCw className="size-3 animate-spin" /> : null}
                  Resend email
                </button>
              </div>
            )}
          </div>
        )}

        {resendStatus && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{resendStatus}</span>
          </div>
        )}

        <button
          type="submit"
          id="sign-in-submit"
          disabled={busy || isLoading}
          className={primaryButtonClass}
        >
          {busy ? "Signing in…" : (
            <>
              Sign in
              <ArrowRight className="size-4 ml-1" />
            </>
          )}
        </button>
      </form>

      {/* OAuth divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground font-semibold tracking-widest">
            Or continue with
          </span>
        </div>
      </div>

      {/* Social buttons */}
      <div className="grid grid-cols-3 gap-2">
        <SocialButton
          onClick={() => void handleSocialSignIn("google-oauth2")}
          disabled={busy || isLoading}
          title="Sign in with Google"
          label="Google"
          icon={<GoogleIcon />}
        />
        <SocialButton
          onClick={() => void handleSocialSignIn("github")}
          disabled={busy || isLoading}
          title="Sign in with GitHub"
          label="GitHub"
          icon={<Github className="size-4" />}
        />
        <SocialButton
          onClick={() => void handleSocialSignIn("linkedin")}
          disabled={busy || isLoading}
          title="Sign in with LinkedIn"
          label="LinkedIn"
          icon={<Linkedin className="size-4 text-[#0A66C2]" />}
        />
      </div>
    </AuthShell>
  );
}

function SocialButton({
  onClick,
  disabled,
  title,
  label,
  icon,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="
        h-10 inline-flex items-center justify-center gap-1.5
        rounded-lg border border-border bg-background
        text-sm font-medium text-foreground
        hover:bg-surface hover:border-foreground/20
        shadow-card hover:shadow-elevated
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all duration-150 cursor-pointer
      "
    >
      {icon}
      <span className="hidden sm:inline text-xs">{label}</span>
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
    </svg>
  );
}
