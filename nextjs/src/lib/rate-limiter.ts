/**
 * Supabase-backed rate limiter for API endpoints.
 *
 * Uses a sliding window per IP address stored in PostgreSQL so it works
 * across all serverless instances. Falls back to in-memory when Supabase
 * is unavailable (testing, development without Supabase).
 *
 * Requires the `check_rate_limit` stored procedure defined in migration 00009.
 */

import { createAdminClient } from "./supabase-admin";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ── In-memory fallback store (used when Supabase RPC is unavailable) ──
const fallbackStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of fallbackStore.entries()) {
    if (entry.resetAt <= now) {
      fallbackStore.delete(key);
    }
  }
}, 300_000);

/**
 * Per-IP promise-chain lock.
 *
 * Ensures that concurrent requests for the same IP acquire the fallback store
 * in FIFO order matching their creation order, preventing the race condition
 * where Promise.all concurrent requests interleave between hashIp/rpc awaits
 * and the fallback counter increment.
 */
const ipLocks = new Map<string, Promise<void>>();

function acquireIpLock(ip: string): Promise<() => void> {
  let release: () => void;
  const ticket = new Promise<void>((resolve) => {
    release = resolve;
  });

  // Atomically chain: capture the previous ticket and insert ours
  const prev = ipLocks.get(ip) ?? Promise.resolve();
  ipLocks.set(ip, ticket);

  return (async () => {
    await prev;
    return () => {
      release!();
      // Only clean up if we're still the current lock (no one queued after us)
      if (ipLocks.get(ip) === ticket) {
        ipLocks.delete(ip);
      }
    };
  })();
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const DEFAULT_AI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60_000, // 10 requests per minute
};

export const DEFAULT_SEARCH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000, // 60 requests per minute
};

/**
 * Hash an IP address with SHA-256 for privacy-preserving rate limiting.
 * Returns first 16 characters (64 bits) of the hex digest — enough for
 * uniqueness but not reversible to the original IP.
 */
async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/**
 * In-memory fallback rate limit check.
 */
function checkRateLimitFallback(
  ip: string,
  config: RateLimitConfig,
): {
  allowed: boolean;
  headers: Record<string, string>;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = fallbackStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    fallbackStore.set(ip, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(config.maxRequests - 1),
        "X-RateLimit-Reset": String(Math.ceil((now + config.windowMs) / 1000)),
      },
    };
  }

  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed: entry.count <= config.maxRequests,
    remaining,
    resetAt: entry.resetAt,
    headers: {
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
      ...(entry.count > config.maxRequests
        ? { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) }
        : {}),
    },
  };
}

/**
 * Check if a request should be rate limited.
 *
 * Uses the Supabase RPC (`check_rate_limit`) by default. Falls back to
 * in-memory if Supabase is unavailable. Returns an object with `allowed`
 * boolean and headers for the response.
 */
export async function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_AI_RATE_LIMIT,
): Promise<{ allowed: boolean; headers: Record<string, string> }> {
  const release = await acquireIpLock(ip);

  try {
    const ipHash = await hashIp(ip);
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_ip_hash: ipHash,
      p_endpoint: "api",
      p_max_requests: config.maxRequests,
      p_window_ms: config.windowMs,
    });

    if (error) throw error;

    const result = data as {
      allowed: boolean;
      remaining: number;
      reset_at: number;
    };
    const resetSeconds = Math.ceil(result.reset_at);

    // Probabilistic cleanup: ~1 in 20 calls triggers a cleanup to prevent
    // unbounded growth without needing pg_cron.
    if (Math.random() < 0.05) {
      cleanupRateLimits().catch(() => {});
    }

    return {
      allowed: result.allowed,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(resetSeconds),
        ...(result.allowed
          ? {}
          : {
              "Retry-After": String(
                resetSeconds - Math.ceil(Date.now() / 1000),
              ),
            }),
      },
    };
  } catch {
    // Fallback to in-memory when Supabase is unavailable
    return checkRateLimitFallback(ip, config);
  } finally {
    release();
  }
}

/**
 * Get a Supabase service client for rate limit cleanup.
 * Should be called periodically (e.g., via a cron job or after requests).
 */
export async function cleanupRateLimits(): Promise<number> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("cleanup_rate_limits", {
      window_minutes: 5,
    });
    if (error) throw error;
    return (data as number) || 0;
  } catch {
    return 0;
  }
}

/**
 * Extract client IP from a Request-like object.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "127.0.0.1";
}
