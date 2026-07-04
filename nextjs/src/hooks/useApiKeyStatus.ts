"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../components/auth-context";

export interface ApiKeyStatus {
  hasStoredKey: boolean;
  loading: boolean;
  error: string | null;
  provider: string | null;
}

/**
 * useApiKeyStatus — Checks whether the signed-in user has a stored AI
 * provider API key.
 *
 * - Returns immediately with `{ hasStoredKey: false, loading: false }`
 *   when the user is not signed in.
 * - Returns `{ ..., loading: true }` while auth state is being resolved
 *   or while the key-status fetch is in flight.
 * - On success sets `hasStoredKey` and `provider` from the server response.
 * - On network or server errors sets `error` and returns `hasStoredKey: false`.
 */
export function useApiKeyStatus(): ApiKeyStatus {
  const { user, loading: authLoading } = useAuth();

  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    // Auth state is still resolving — keep loading
    if (authLoading) return;

    // User is not signed in — no key possible
    if (!user) {
      setHasStoredKey(false);
      setLoading(false);
      setError(null);
      setProvider(null);
      return;
    }

    let cancelled = false;

    fetch("/api/settings/api-key/status")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        return res.json();
      })
      .then(
        (data: { hasKey?: boolean; provider?: string | null }) => {
          if (cancelled) return;
          setHasStoredKey(data.hasKey ?? false);
          setProvider(data.provider ?? null);
          setLoading(false);
        },
        (err: unknown) => {
          if (cancelled) return;
          const msg =
            err instanceof Error ? err.message : "Failed to check API key status";
          setError(msg);
          setHasStoredKey(false);
          setLoading(false);
        },
      );

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { hasStoredKey, loading, error, provider };
}
