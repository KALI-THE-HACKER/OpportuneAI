import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setApiAuthToken } from "@/lib/api/client";
import { authApi, getStoredSession, persistSession, type Session } from "@/lib/api/auth";
import { userApi } from "@/lib/api/user";
import type { UserProfile } from "@/lib/mock/user";

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<Session>;
  signInWithSocial: (connection: "google-oauth2" | "github" | "linkedin") => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated: isAuth0Authenticated,
    isLoading: isAuth0Loading,
    getAccessTokenSilently,
    loginWithRedirect,
    logout,
  } = useAuth0();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [localSession, setLocalSession] = useState<Session | null>(null);
  const [isProfileLoading, setProfileLoading] = useState(true);

  // Initialize from local storage on mount
  useEffect(() => {
    const session = getStoredSession();
    if (session) {
      setLocalSession(session);
      setUser(session.user);
      setApiAuthToken(session.token);
    }
    setProfileLoading(false);
  }, []);

  // Sync Auth0 state when it loads
  useEffect(() => {
    async function syncAuth0Token() {
      if (isAuth0Authenticated) {
        setProfileLoading(true);
        try {
          const token = await getAccessTokenSilently();
          setApiAuthToken(token);
          const profile = await userApi.get();
          setUser(profile);

          const session: Session = {
            token,
            user: profile,
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
          };
          persistSession(session);
          setLocalSession(session);
        } catch (error) {
          console.error("Failed to sync Auth0 token:", error);
        } finally {
          setProfileLoading(false);
        }
      }
    }

    if (!isAuth0Loading) {
      void syncAuth0Token();
    }
  }, [isAuth0Authenticated, isAuth0Loading, getAccessTokenSilently]);

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading: isAuth0Loading || isProfileLoading,
    async signIn(email, password) {
      setProfileLoading(true);
      try {
        const session = await authApi.signIn(email, password);
        setLocalSession(session);
        setUser(session.user);
        setApiAuthToken(session.token);
      } finally {
        setProfileLoading(false);
      }
    },
    async signUp(name, email, password) {
      setProfileLoading(true);
      try {
        const session = await authApi.signUp(name, email, password);
        if (session.token) {
          setLocalSession(session);
          setUser(session.user);
          setApiAuthToken(session.token);
        } else {
          persistSession(null);
          setLocalSession(null);
          setUser(null);
          setApiAuthToken(null);
        }
        return session;
      } finally {
        setProfileLoading(false);
      }
    },
    async signInWithSocial(connection) {
      await loginWithRedirect({
        authorizationParams: { connection },
      });
    },
    async signOut() {
      persistSession(null);
      setLocalSession(null);
      setUser(null);
      setApiAuthToken(null);

      // If signed in via Auth0, trigger Auth0 logout redirect
      if (isAuth0Authenticated) {
        await logout({
          logoutParams: {
            returnTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
      }
    },
    async refresh() {
      if (user) {
        try {
          const profile = await userApi.get();
          setUser(profile);
          if (localSession) {
            const updated = { ...localSession, user: profile };
            persistSession(updated);
            setLocalSession(updated);
          }
        } catch (error) {
          console.error("Failed to refresh user profile:", error);
        }
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
