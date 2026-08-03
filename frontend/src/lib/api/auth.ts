import { apiCall } from "./client";
import { type UserProfile } from "../mock/user";

const SESSION_KEY = "opportune.session";

export interface Session {
  token: string;
  user: UserProfile;
  expiresAt: number;
  message?: string;
}

export function parseJwtExp(token: string): number | null {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    if (payload && typeof payload.exp === "number") {
      return payload.exp * 1000;
    }
  } catch {
    // ignore parsing failure
  }
  return null;
}

export function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.expiresAt < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function persistSession(session: Session | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export const authApi = {
  async signIn(email: string, password: string): Promise<Session> {
    const session = await apiCall<Session>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persistSession(session);
    return session;
  },
  async signUp(name: string, email: string, password: string): Promise<Session> {
    const session = await apiCall<Session>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
    persistSession(session);
    return session;
  },
  async signOut(): Promise<void> {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  },
  async requestPasswordReset(email: string): Promise<void> {
    throw new Error("Password reset is managed via Auth0");
  },
  async resetPassword(token: string, password: string): Promise<void> {
    throw new Error("Password reset is managed via Auth0");
  },
  async verifyEmail(token: string): Promise<void> {
    throw new Error("Email verification is managed via Auth0");
  },
  async resendVerification(): Promise<void> {
    throw new Error("Email verification is managed via Auth0");
  },
};
export { persistSession as persist };
