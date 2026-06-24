import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client factory.
 *
 * Env vars are checked lazily (at function call time) so that this module
 * can be imported in test environments without NEXT_PUBLIC_SUPABASE_URL
 * being set at import time. Tests mock @supabase/ssr directly.
 */
function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Supabase environment variable "${name}" not configured.`);
  }
  return val;
}

// Server client for API routes (instantiated per-request with cookie store)
export function getServerClient(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) {
  // Lazy env var resolution — not evaluated at module import time
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
