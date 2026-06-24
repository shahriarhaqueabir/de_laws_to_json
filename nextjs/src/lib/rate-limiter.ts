/**
 * Simple in-memory rate limiter for API endpoints.
 *
 * Uses a sliding window per IP address. For serverless/edge deployments
 * this is best-effort (not shared across instances). For production,
 * replace with Redis or Supabase-based rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 300_000);

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
 * Check if a request should be rate limited.
 * Returns an object with `allowed` boolean and headers for the response.
 */
export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = DEFAULT_AI_RATE_LIMIT,
): { allowed: boolean; headers: Record<string, string> } {
  const now = Date.now();
  const entry = store.get(ip);

  // First request or window expired
  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      headers: {
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": String(config.maxRequests - 1),
        "X-RateLimit-Reset": String(Math.ceil((now + config.windowMs) / 1000)),
      },
    };
  }

  // Increment within window
  entry.count++;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(config.maxRequests),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
      },
    };
  }

  return {
    allowed: true,
    headers: {
      "X-RateLimit-Limit": String(config.maxRequests),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    },
  };
}

/**
 * Extract client IP from a NextRequest.
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
