import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { AuthShell, FormField, inputClass, primaryButtonClass } from "@/components/auth/auth-shell";
import { useAuth } from "@/hooks/use-auth";
import { Github, Linkedin, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth/sign-up")({
  head: () => ({
    meta: [
      { title: "Create account · OpportuneAI" },
      { name: "description", content: "Create your OpportuneAI account." },
    ],
  }),
  component: SignUpPage,
});

function SignUpPage() {
  const { signUp, signInWithSocial, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Password strength check
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    let metCount = 0;
    if (hasLower) metCount++;
    if (hasUpper) metCount++;
    if (hasNumber) metCount++;
    if (hasSpecial) metCount++;
    if (metCount < 3) {
      return setError(
        "Password is too weak. It must contain at least 3 of: lowercase, uppercase, numbers, or special characters.",
      );
    }

    setBusy(true);
    try {
      const session = await signUp(name.trim(), email.trim(), password);
      if (session && session.token) {
        navigate({ to: "/app/dashboard", replace: true });
      } else {
        setSuccessMessage(
          session?.message ??
            "Registration succeeded! Please check your email to verify your account.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSocialSignIn(provider: "google-oauth2" | "github" | "linkedin") {
    setError(null);
    setBusy(true);
    try {
      await signInWithSocial(provider);
      navigate({ to: "/app/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Sign up with ${provider} failed`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      description="Build your AI profile in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link
            to="/auth/sign-in"
            className="font-semibold text-foreground hover:text-accent transition-colors"
          >
            Sign in
          </Link>
        </>
      }
    >
      {successMessage ? (
        <div className="space-y-6 text-center py-4 animate-in fade-in zoom-in duration-300">
          <div className="size-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold tracking-tight">Account created!</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">{successMessage}</p>
          </div>
          <Link
            to="/auth/sign-in"
            className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-brand text-brand-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to sign in
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField label="Full name" htmlFor="name">
              <input
                id="name"
                type="text"
                autoComplete="name"
                required
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
              />
            </FormField>
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
                autoComplete="new-password"
                required
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
              />
            </FormField>
            <p className="text-[11px] text-muted-foreground">
              Min. 8 characters with at least 3 of: lowercase, uppercase, numbers, or symbols.
            </p>

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 p-3 rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-1 duration-250">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              id="sign-up-submit"
              disabled={busy || isLoading}
              className={primaryButtonClass}
            >
              {busy ? "Creating account…" : (
                <>
                  Create account
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
              title="Sign up with Google"
              label="Google"
              icon={<GoogleIcon />}
            />
            <SocialButton
              onClick={() => void handleSocialSignIn("github")}
              disabled={busy || isLoading}
              title="Sign up with GitHub"
              label="GitHub"
              icon={<Github className="size-4" />}
            />
            <SocialButton
              onClick={() => void handleSocialSignIn("linkedin")}
              disabled={busy || isLoading}
              title="Sign up with LinkedIn"
              label="LinkedIn"
              icon={<Linkedin className="size-4 text-[#0A66C2]" />}
            />
          </div>
        </>
      )}
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
