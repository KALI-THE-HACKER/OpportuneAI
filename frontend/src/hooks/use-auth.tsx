import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { setApiAuthToken } from "@/lib/api/client";
import { authApi, getStoredSession, parseJwtExp, persistSession, type Session } from "@/lib/api/auth";
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

function clearOnboardingRedirect() {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("onboarding_redirected");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    user: auth0User,
    isAuthenticated: isAuth0Authenticated,
    isLoading: isAuth0Loading,
    getAccessTokenSilently,
    getIdTokenClaims,
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
      if (isAuth0Authenticated && auth0User) {
        const initialUser: UserProfile = {
          id: auth0User.sub || "auth0-user",
          name: auth0User.name || auth0User.nickname || "Authenticated User",
          email: auth0User.email || "",
          avatarUrl: auth0User.picture,
          title: "",
          location: "",
          bio: "",
          yearsOfExperience: 0,
          skills: [],
          preferredRoles: [],
          preferredLocations: [],
          workModes: [],
          minSalary: 0,
          emailVerified: auth0User.email_verified || false,
        };
        setUser(initialUser);
        setProfileLoading(false);

        try {
          let token: string | null = null;
          try {
            token = await getAccessTokenSilently();
          } catch {
            const claims = await getIdTokenClaims();
            token = claims?.__raw || null;
          }

          if (token) {
            setApiAuthToken(token);
            const backendProfile = await userApi.get().catch(() => null);
            const finalUser = backendProfile || initialUser;
            clearOnboardingRedirect();
            setUser(finalUser);

            const jwtExp = parseJwtExp(token);
            const expiresAt = jwtExp || Date.now() + 1000 * 60 * 60 * 24 * 7;

            const session: Session = {
              token,
              user: finalUser,
              expiresAt,
            };
            persistSession(session);
            setLocalSession(session);
          }
        } catch (error) {
          console.error("Auth0 token sync error:", error);
          persistSession(null);
          setLocalSession(null);
          setApiAuthToken(null);
        }
      }
    }

    if (!isAuth0Loading) {
      void syncAuth0Token();
    }
  }, [isAuth0Authenticated, isAuth0Loading, auth0User, getAccessTokenSilently, getIdTokenClaims]);

  const value: AuthState = {
    user,
    isAuthenticated: !!user,
    isLoading: isAuth0Loading || isProfileLoading,
    async signIn(email, password) {
      setProfileLoading(true);
      try {
        clearOnboardingRedirect();
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
        clearOnboardingRedirect();
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
      const isMockMode =
        import.meta.env.VITE_AUTH0_CLIENT_ID === "mock_client_id" ||
        !import.meta.env.VITE_AUTH0_CLIENT_ID;

      if (isMockMode) {
        setProfileLoading(true);
        try {
          clearOnboardingRedirect();
          const mockToken = `mock-${connection}|google-user-123;google.user@opportune.ai;Google User;https://lh3.googleusercontent.com/a/default-user`;
          setApiAuthToken(mockToken);
          const profile = await userApi.get();
          setUser(profile);

          const session: Session = {
            token: mockToken,
            user: profile,
            expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
          };
          persistSession(session);
          setLocalSession(session);
        } finally {
          setProfileLoading(false);
        }
      } else {
        await loginWithRedirect({
          authorizationParams: { connection },
        });
      }
    },
    async signOut() {
      clearOnboardingRedirect();
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
