"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { ApiError, apiUrl } from "@/lib/api";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";

export { ApiError };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  /** fetch() a backend /api route with the user's Firebase ID token; retries once with a refreshed token on 401. */
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const registered = useRef<string | null>(null);

  const api = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const current = clientAuth().currentUser;
    if (!current) throw new ApiError(401, "Please sign in.");
    const call = async (forceRefresh: boolean) => {
      const token = await current.getIdToken(forceRefresh);
      return fetch(apiUrl(path), {
        ...init,
        headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
    };
    let res: Response;
    try {
      res = await call(false);
      if (res.status === 401) res = await call(true);
    } catch {
      // Also hit when the API is unreachable or waking up (Render free instances sleep when idle).
      throw new ApiError(0, "Couldn't reach the server. It may be waking up; please try again in a few seconds.");
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.code);
    return body as T;
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u);
      setLoading(false);
      // Ensure the user has a row in Postgres (idempotent upsert), once per sign-in.
      if (u && registered.current !== u.uid) {
        registered.current = u.uid;
        api("/api/me", { method: "POST" }).catch((err) => console.warn("Profile sync failed:", err.message));
      }
      if (!u) registered.current = null;
    });
  }, [api]);

  const signOut = useCallback(async () => {
    await fbSignOut(clientAuth());
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, configured: firebaseConfigured, signOut, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
