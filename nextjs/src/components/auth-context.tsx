"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { syncBookmarksToSupabase } from "../lib/bookmarks-v2";

// Lazy-initialized: created on first client-side access, not at module import time
// This prevents SSR crashes where document is not defined (@supabase/ssr reads cookies)
let _supabase: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getClient()
      .auth.getUser()
      .then(
        ({ data }) => {
          if (!cancelled) {
            setUser(data.user);
            setLoading(false);
          }
        },
        (err) => {
          console.error("[DIAG] AuthProvider: getUser failed:", err);
          if (!cancelled) {
            setLoading(false);
          }
        },
      );

    const {
      data: { subscription },
    } = getClient().auth.onAuthStateChange((event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
        if (event === "SIGNED_IN") {
          syncBookmarksToSupabase();
        }
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    const { error } = await getClient().auth.signInWithPassword({
      email,
      password,
    });
    return error?.message ?? null;
  };

  const signUp = async (
    email: string,
    password: string,
  ): Promise<string | null> => {
    const { error } = await getClient().auth.signUp({ email, password });
    return error?.message ?? null;
  };

  const signOut = async () => {
    await getClient().auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
