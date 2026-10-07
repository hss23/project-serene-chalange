"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut as fbSignOut, type User } from "firebase/auth";
import { ApiError, apiUrl } from "@/lib/api";
import { clientAuth, firebaseConfigured } from "@/lib/firebase/client";
import type { Me, Role } from "@/lib/types";

export { ApiError };

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** The backend account (role, status, profile completeness). Null until loaded or when signed out. */
  me: Me | null;
  meLoading: boolean;
  meError: string | null;
  refreshMe: () => Promise<Me | null>;
  /** Remember the role picked on the sign-up form; it's applied as soon as the account exists. */
  setPendingRole: (role: Role | null) => void;
  signOut: () => Promise<void>;
  /** fetch() a backend /api route with the user's Firebase ID token; retries once with a refreshed token on 401. */
  api: <T>(path: string, init?: RequestInit) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoading, setMeLoading] = useState(false);
  const [meError, setMeError] = useState<string | null>(null);
  const pendingRole = useRef<Role | null>(null);
  const lastFocusRefresh = useRef(0);

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

  /** Sync the account with the backend and apply a role chosen on the sign-up form. */
  const refreshMe = useCallback(async (): Promise<Me | null> => {
    if (!clientAuth().currentUser) return null;
    setMeLoading(true);
    try {
      let next = await api<Me>("/api/me", { method: "POST" });
      if (!next.user.role && pendingRole.current) {
        next = await api<Me>("/api/me/role", { method: "POST", body: JSON.stringify({ role: pendingRole.current }) });
      }
      pendingRole.current = null;
      setMe(next);
      setMeError(null);
      return next;
    } catch (err) {
      setMeError((err as Error).message);
      return null;
    } finally {
      setMeLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    return onAuthStateChanged(clientAuth(), (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        refreshMe();
      } else {
        setMe(null);
        setMeError(null);
      }
    });
  }, [refreshMe]);

  // Pick up role/status changes made by an admin when the user comes back to the tab.
  useEffect(() => {
    const onFocus = () => {
      if (!clientAuth().currentUser || Date.now() - lastFocusRefresh.current < 30_000) return;
      lastFocusRefresh.current = Date.now();
      refreshMe();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshMe]);

  const setPendingRole = useCallback((role: Role | null) => {
    pendingRole.current = role;
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(clientAuth());
    setMe(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, configured: firebaseConfigured, me, meLoading, meError, refreshMe, setPendingRole, signOut, api }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
