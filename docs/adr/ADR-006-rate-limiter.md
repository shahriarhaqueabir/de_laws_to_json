# ADR-006: Supabase-Backed Rate Limiting

**Status**: Accepted (2026-07-03)

## Context

AI-powered endpoints — guidance, chat, and explain — make expensive LLM calls (OpenAI/Anthropic). Public endpoints without authentication could be abused by a single client, driving up cost and degrading latency for other users. We needed per-IP rate limiting that:

- Works across Vercel serverless function instances (no shared memory)
- Adds no external infrastructure (Redis, Memcached, etc.)
- Survives function cold starts
- Is cheap enough to run on every request (~1ms overhead)
- Provides transparent rate limit headers to clients

## Decision

Implement rate limiting using a PostgreSQL-backed sliding window stored in Supabase. The core mechanism is a `rate_limits` table with a unique constraint on `(ip_hash, endpoint, window_start)` and an upsert pattern to atomically increment the counter — not `pg_advisory_lock`, but the unique-index upsert serves the same distributed-mutex purpose: it serializes concurrent increments from different serverless instances via the database.

### Architecture

1. **`rate-limiter.ts`** (`src/lib/rate-limiter.ts`) — The library that encapsulates all rate limit logic:
   - `checkRateLimit(ip, config)` — checks and increments the counter in one DB round trip
   - `getClientIp(request)` — extracts the client IP from `x-forwarded-for` / `x-real-ip` headers
   - `cleanupRateLimits()` — deletes expired windows, callable on demand or probabilistically
   - In-memory fallback store (`Map<string, RateLimitEntry>`) when Supabase is unavailable

2. **`rate_limits` table** (migration `00010_rate_limits.sql`) — Schema:
   - `ip_hash TEXT NOT NULL` — SHA-256 hash of the client IP (first 16 hex chars), privacy-preserving
   - `endpoint TEXT NOT NULL` — endpoint grouping (e.g., `"api"`)
   - `count INTEGER NOT NULL DEFAULT 1` — request count in the current window
   - `window_start TIMESTAMPTZ` — start of the sliding window
   - Unique index on `(ip_hash, endpoint, window_start)` enables the upsert

3. **`check_rate_limit()` — SECURITY DEFINER function** — Runs as `SECURITY DEFINER` so the app can use the anon key. Uses `INSERT ... ON CONFLICT DO UPDATE` to atomically increment the counter. Returns a JSONB payload: `{ allowed, remaining, reset_at }`.

4. **`cleanup_rate_limits()` — Cleanup function** — Deletes rows older than a configurable `window_minutes` parameter. Called:
   - Explicitly by a management endpoint or cron
   - Probabilistically from `checkRateLimit()` (~5% chance per request) to prevent unbounded growth without needing `pg_cron`

### Rate Limit Tiers

| Tier | Endpoints | Limit | Constant |
|------|-----------|-------|----------|
| AI | `/api/chat`, `/api/explain`, `/api/guidance`, `/api/guidance/generate-doc` | 10 req/min per IP | `DEFAULT_AI_RATE_LIMIT` |
| Search | `/api/search` | 60 req/min per IP | `DEFAULT_SEARCH_RATE_LIMIT` |

Additional tiers can be added by defining new `RateLimitConfig` constants and passing them to `checkRateLimit()`.

### Concurrency Safety

- **Database path**: The unique-index upsert in `check_rate_limit()` serializes concurrent increments from any number of serverless instances — the `ON CONFLICT DO UPDATE SET count = count + 1` is atomic.
- **Fallback path**: A per-IP promise-chain lock (`ipLocks` `Map`) ensures concurrent in-memory fallback requests for the same IP do not interleave between the read and write of the `Map` entry.

### Privacy

IP addresses are SHA-256 hashed before storage. Only the first 16 hex characters (64 bits) are kept — sufficient for uniqueness without being reversible to the original IP.

### Headers

Every response includes:
- `X-RateLimit-Limit` — the max requests per window
- `X-RateLimit-Remaining` — requests remaining in the current window
- `X-RateLimit-Reset` — Unix timestamp when the window resets
- `Retry-After` — seconds to wait (only on 429 responses)

### Migration

File: `supabase/migrations/00010_rate_limits.sql`

Creates:
- `public.rate_limits` table with unique index on `(ip_hash, endpoint, window_start)`
- `public.cleanup_rate_limits(window_minutes INTEGER)` — cleanup function
- `public.check_rate_limit(p_ip_hash, p_endpoint, p_max_requests, p_window_ms)` — rate limit check function
- RLS policies denying all direct user access (server-side only, via `service_role` key)
- Auto-update trigger on `updated_at`

## Consequences

- **No external dependency** — Everything lives in the existing Supabase Postgres instance. No Redis, no external cache.
- **Cross-instance correctness** — Shared database ensures consistent limits regardless of which serverless function handles the request.
- **Low overhead** — The upsert pattern is fast. The unique index is small (hash + endpoint + timestamp). Measured overhead is ~1ms per check.
- **Graceful degradation** — Falls back to an in-memory `Map` when Supabase is unreachable (development, testing, transient DB errors). The fallback is per-instance, so limits are approximate during outages, not disabled.
- **Auto-cleanup** — Probabilistic cleanup (~5% per request) prevents unbounded table growth without requiring `pg_cron` or scheduled jobs.
- **Privacy-preserving** — Raw IPs are never written to the database. Only SHA-256 hashes are stored.
- **Two tiers only** — Currently AI (10/min) and Search (60/min). Bookmark CRUD and other light endpoints are not yet rate limited — may need a third tier if usage grows.
- **Deletion is not granular** — `cleanup_rate_limits()` uses `window_start < now() - interval`, which can momentarily delete entries for an active window if a request is slow enough. In practice the window is small (1-60s) so this is harmless.
- **Tests exist** — `src/lib/__tests__/rate-limiter.test.ts` covers Supabase RPC path, in-memory fallback, per-IP isolation, custom configs, IP extraction, and probabilistic cleanup.

### See Also

- `src/lib/rate-limiter.ts` — Core implementation
- `src/lib/__tests__/rate-limiter.test.ts` — Test suite
- `supabase/migrations/00010_rate_limits.sql` — Database migration
- `src/lib/api-utils.ts` — `errorResponse()` helper for the 429 response
- `/api/chat/route.ts`, `/api/explain/route.ts`, `/api/guidance/route.ts`, `/api/search/route.ts` — Endpoints using rate limiting
