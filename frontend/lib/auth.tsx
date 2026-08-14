"use client";

/**
 * Who is signed in.
 *
 * The token lives in localStorage so a page refresh keeps you signed in.
 * On first load we ask the backend "/api/auth/me" to check the token is
 * still good, and sign out if it is not.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { api, setToken } from "./api";
import type { User } from "./types";

type AuthState = {
  user: User | null;
  /** True until we have finished checking the saved token. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .me()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch(() => {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    setToken(result.token);
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined); // signing out should never fail loudly
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
