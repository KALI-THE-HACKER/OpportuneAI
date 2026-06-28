import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, getStoredSession, type Session } from "@/lib/api";
import type { UserProfile } from "@/lib/mock/user";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredSession());
    setLoading(false);
  }, []);

  const value: AuthState = {
    user: session?.user ?? null,
    isAuthenticated: !!session,
    isLoading,
    refresh: () => setSession(getStoredSession()),
    async signIn(email, password) {
      const s = await authApi.signIn(email, password);
      setSession(s);
    },
    async signUp(name, email, password) {
      const s = await authApi.signUp(name, email, password);
      setSession(s);
    },
    async signOut() {
      await authApi.signOut();
      setSession(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}