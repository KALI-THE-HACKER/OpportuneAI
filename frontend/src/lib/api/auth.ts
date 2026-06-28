import { delay, ApiError } from "./client";
import { MOCK_USER, type UserProfile } from "../mock/user";

const SESSION_KEY = "opportune.session";

export interface Session {
  token: string;
  user: UserProfile;
  expiresAt: number;
}

function persist(session: Session | null) {
  if (typeof window === "undefined") return;
  if (!session) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export const authApi = {
  async signIn(email: string, password: string): Promise<Session> {
    if (!email || password.length < 6)
      throw new ApiError(400, "Invalid credentials");
    const session: Session = {
      token: "mock-" + Math.random().toString(36).slice(2),
      user: { ...MOCK_USER, email },
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    await delay(null, 600);
    persist(session);
    return session;
  },
  async signUp(name: string, email: string, password: string): Promise<Session> {
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
    const session: Session = {
      token: "mock-" + Math.random().toString(36).slice(2),
      user: { ...MOCK_USER, name, email, emailVerified: false },
      expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7,
    };
    await delay(null, 700);
    persist(session);
    return session;
  },
  async signOut(): Promise<void> {
    await delay(null, 200);
    persist(null);
  },
  async requestPasswordReset(email: string): Promise<void> {
    if (!email.includes("@")) throw new ApiError(400, "Invalid email");
    await delay(null, 500);
  },
  async resetPassword(token: string, password: string): Promise<void> {
    if (!token) throw new ApiError(400, "Invalid token");
    if (password.length < 8) throw new ApiError(400, "Password too short");
    await delay(null, 500);
  },
  async verifyEmail(token: string): Promise<void> {
    if (!token) throw new ApiError(400, "Invalid token");
    await delay(null, 500);
    const s = getStoredSession();
    if (s) persist({ ...s, user: { ...s.user, emailVerified: true } });
  },
  async resendVerification(): Promise<void> {
    await delay(null, 400);
  },
};