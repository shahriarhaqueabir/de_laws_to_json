# Security Architecture — German Law Vault

> **Last updated:** 2026-06-26
> **Project:** AI-Assisted-German-Law
> **Stack:** Next.js 16 (App Router) + Supabase + Qdrant Cloud

---

## Table of Contents

1. [Threat Model](#1-threat-model)
2. [Content Security Policy](#2-content-security-policy)
3. [Authentication Flow](#3-authentication-flow)
4. [Encryption at Rest](#4-encryption-at-rest)
5. [Rate Limiting](#5-rate-limiting)
6. [RLS Policy Summary](#6-rls-policy-summary)
7. [Secret Scanning & Supply Chain](#7-secret-scanning--supply-chain)
8. [Known Security Gaps](#8-known-security-gaps)
9. [Security Testing](#9-security-testing)

---

## 1. Threat Model

### XSS (Cross-Site Scripting)

**How it's prevented:**
- **CSP `script-src`** restricts script execution to `'self'`, known CDNs (`https://cdn.jsdelivr.net`), and `blob:` URIs. Inline scripts require `'unsafe-inline'` (see [gap 8.2](#82-csp-uses-unsafe-inline-and-unsafe-eval)).
- **React 19** escapes all JSX expressions by default. The project never uses `dangerouslySetInnerHTML`.
- **No raw HTML rendering** in any component — all dynamic content flows through React's text node serialization.
- **`<base-uri 'self'>`** prevents base tag injection attacks.

### CSRF (Cross-Site Request Forgery)

**How it's prevented:**
- **Supabase SSR** uses HttpOnly, SameSite cookies for session management. The `@supabase/ssr` library sets `SameSite=Lax` by default on auth cookies.
- **CSP `form-action 'self'`** restricts form submissions to same-origin.
- All state-changing API routes (`POST`, `PATCH`, `DELETE`) require a valid Supabase session via `auth.getUser()`. Without a session cookie, requests return `401 UNAUTHORIZED`.
- **Note:** No explicit CSRF tokens are issued beyond SameSite cookies. See [gap 8.4](#84-no-dedicated-csrf-tokens).

### SQL Injection

**How it's prevented:**
- **All database queries** go through the Supabase JavaScript client (`@supabase/supabase-js`), which parameterizes queries automatically.
- **No raw SQL interpolation** anywhere in the application. The sole exception is the Supabase Studio SQL editor used for migrations (admin-only).
- **Zod validation** on all API route inputs (`z.string()`, `z.number()`, `z.enum()`, etc.) ensures type safety before data reaches the database layer.
- The Supabase `eq()`, `in()`, `select()`, `insert()`, `update()` chain methods are inherently parameterized.

### IDOR (Insecure Direct Object Reference)

**How it's prevented — defense in depth:**

1. **Row Level Security (RLS):** Every user-owned table has a policy enforcing `auth.uid() = user_id` (or an equivalent subquery through ownership chains). RLS acts as a database-level guard that applies regardless of which client queries the table.
2. **API-level user_id filtering:** Every route that accesses user-owned data filters by `user.id` from the authenticated session — e.g., `.eq("user_id", user.id)`.
3. **Ownership verification before writes:** The chat API verifies conversation ownership before inserting messages:
   ```ts
   const { data: conv } = await supabase
     .from("conversations")
     .select("id")
     .eq("id", conversationId)
     .eq("user_id", user.id)
     .single();
   if (!conv) return errorResponse("NOT_FOUND", "Conversation not found", 404);
   ```
4. **UUID primary keys** are used everywhere (`gen_random_uuid()`), making resource IDs unpredictable.

### API Key Leakage

**How it's prevented:**

1. **Server-side-only key storage:** User API keys (OpenAI, Anthropic) are never sent to the client. They are encrypted via `encryptApiKey()` in `lib/encryption.ts` and stored in the `user_api_keys` table. Only the `provider` and `updated_at` metadata are exposed to the client via `/api/settings/api-key/status`.
2. **`sanitizeErrorMessage()` in `lib/sanitize.ts`** scrubs sensitive patterns from error messages before returning them to the client:
   ```ts
   const API_KEY_PATTERNS = [
     /sk-[A-Za-z0-9_-]{20,}/,          // OpenAI
     /sk-ant-[A-Za-z0-9_-]{20,}/,      // Anthropic
     /sk-proj-[A-Za-z0-9_-]{20,}/,     // OpenAI project
     /Bearer\s+[A-Za-z0-9._-]{20,}/i,  // Bearer tokens
     /(?:Authorization|X-API-Key|api[_-]?key):\s*['"]?[A-Za-z0-9_-]{10,}['"]?/i,
     /[?&](?:api_key|apiKey|key)=\w+/i, // Query params
   ];
   ```
   If any pattern matches, a generic message is returned: `"Cloud AI call failed. Check your API key and provider settings."`
3. **Full errors are logged server-side** — the sanitize function does not suppress logging, only client-facing responses.
4. **No client-supplied API keys** — the `/api/explain` endpoint explicitly refuses client-supplied keys (see comment in route: *"Never accepts client-supplied keys directly to prevent the endpoint from being used as an open AI proxy"*).

### Clickjacking

**How it's prevented:**
- **CSP `frame-ancestors 'none'`** prevents the application from being embedded in any iframe, frame, or object element.
- This is the modern equivalent of `X-Frame-Options: DENY` and is supported in all major browsers.

### MIME Sniffing

**How it's prevented:**
- **`X-Content-Type-Options: nosniff`** is set on all responses via the Next.js headers configuration. This forces browsers to respect declared `Content-Type` headers and prevents MIME-type confusion attacks.

### Session Hijacking

**How it's prevented:**
- **`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`** enforces HTTPS for all subdomains for 2 years. The project is eligible for HSTS preload lists.
- **Supabase SSR** sets secure, HttpOnly cookies for session tokens. Session cookies are not accessible via JavaScript (`document.cookie`).
- **Post-authentication redirect URIs** are allowlisted in Supabase config (`additional_redirect_urls`). Open redirect attacks are prevented.
- **Refresh token rotation** is enabled in Supabase auth config (`enable_refresh_token_rotation = true`), with a 10-second reuse interval.

### Worker-Based Attacks (Spectre/Meltdown)

**How it's prevented:**
- **`Cross-Origin-Opener-Policy: same-origin`** (COOP) isolates the browsing context from cross-origin openers, preventing cross-origin information leaks.
- **`Cross-Origin-Embedder-Policy: credentialless`** (COEP) prevents cross-origin resources from being loaded without explicit CORS headers, but without blocking credentialed subresources.
- **Note:** COOP/COEP together enable `SharedArrayBuffer` for Transformers.js in the browser worker, which is the reason for their inclusion.

### Supply Chain

**How it's prevented:**
- **Dependabot** is configured in `.github/dependabot.yml` for both npm and GitHub Actions ecosystems, running weekly scans with grouped updates for React, Supabase, Qdrant, TypeScript/ESLint, and testing packages.
- **Package lockfile** (`package-lock.json`) is committed to lock dependency versions.
- **No unverified dependencies** — the project exclusively uses well-known packages from the npm registry (`@supabase/*`, `@qdrant/*`, `next`, `react`, `zod`, `lucide-react`, `motion`).
- **`overrides` field** in `package.json` pins `postcss` to `^8.5.10` for security consistency.
- **Secret scanning** — see [Section 7](#7-secret-scanning--supply-chain).

---

## 2. Content Security Policy

The CSP is defined in `nextjs/next.config.ts` and applied to all routes via the `async headers()` function.

### Full Policy (Main Application)

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' http://localhost:9000 http://localhost:* https://cdn.jsdelivr.net
  https://*.supabase.co wss://*.supabase.co https://*.qdrant.io https://huggingface.co https://us.aws.cdn.hf.co;
worker-src 'self' blob: https://cdn.jsdelivr.net https://huggingface.co https://us.aws.cdn.hf.co;
child-src 'self' blob:;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

### Directive Breakdown

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'self'` | Base restriction — all resources default to same-origin |
| `script-src` | `'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net` | **`'unsafe-inline'`** required by Next.js for its client-side JS bundles. **`'unsafe-eval'`** required by `@huggingface/transformers` (Transformers.js) for WebAssembly model evaluation. **`'wasm-unsafe-eval'`** for WASM module execution. **`blob:`** for worker scripts. **`cdn.jsdelivr.net`** for Hugging Face model hosted files. |
| `style-src` | `'self' 'unsafe-inline'` | `'unsafe-inline'` required by Next.js CSS-in-JS and Tailwind's runtime injection. |
| `img-src` | `'self' data: https:` | Broad `https:` wildcard allows images from any HTTPS source. See [gap 8.3](#83-img-src-uses-https-wildcard). |
| `connect-src` | `'self' http://localhost:* https://cdn.jsdelivr.net https://*.supabase.co wss://*.supabase.co https://*.qdrant.io https://huggingface.co https://us.aws.cdn.hf.co` | Supabase (REST + WebSocket realtime), Qdrant Cloud API, Hugging Face model hosting, and local development broker. |
| `worker-src` | `'self' blob: https://cdn.jsdelivr.net https://huggingface.co https://us.aws.cdn.hf.co` | Web Worker support for Transformers.js browser-mode inference. |
| `child-src` | `'self' blob:` | Fallback for older browsers; covers worker-like contexts. |
| `frame-ancestors` | `'none'` | Anti-clickjacking — the app cannot be embedded in any iframe. |
| `base-uri` | `'self'` | Prevents injection of malicious `<base>` tags. |
| `form-action` | `'self'` | Anti-CSRF — form submissions only allowed to same origin. |

### API-Docs Policy

A separate, slightly stricter policy applies to `api-docs/:path*`:

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
connect-src 'self' http://localhost:9000 http://localhost:* https://*.supabase.co wss://*.supabase.co
  https://*.qdrant.io https://huggingface.co https://us.aws.cdn.hf.co;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

The Swagger UI page omits `blob:` and CDN sources since it doesn't run Transformers.js workers.

---

## 3. Authentication Flow

### Architecture

Authentication uses **Supabase SSR** (`@supabase/ssr` v0.12+), which implements the **PKCE (Proof Key for Code Exchange)** OAuth 2.0 flow. No client-side secrets are used — the `anon` key is publishable and safe for public exposure.

### Key Components

| Component | File | Role |
|-----------|------|------|
| Browser Client | `lib/supabase.ts` | `createBrowserClient()` — used in client components |
| Server Client | `lib/supabase-server.ts` | `createServerClient()` with per-request cookie store |
| Proxy/Middleware | `src/proxy.ts` | Session refresh via `supabase.auth.getUser()` on every navigation |

### Session Flow

```
┌─────────┐         ┌──────────┐         ┌──────────┐
│ Browser │         │  Next.js │         │ Supabase │
│          │         │  Server   │         │   Auth    │
└────┬────┘         └────┬─────┘         └────┬─────┘
     │                    │                     │
     │── POST /auth/login→│                     │
     │                    │── PKCE Challenge──→│
     │                    │←── Auth URL ───────│
     │←── Redirect ───────│                     │
     │── GET /auth/callback →│                  │
     │                    │── Auth Code ──────→│
     │                    │←── Session Tokens──│
     │                    │                     │
     │                    │ Set HttpOnly cookies │
     │←── App Page ───────│                     │
```

### Cookie Management

- **Browser client:** `createBrowserClient()` handles cookie read/write automatically via `@supabase/ssr`.
- **Server client:** Created per-request with the current `cookieStore` (from `next/headers`). The `setAll` callback silently handles Server Component calls where cookie writes are unavailable.
- **Proxy (src/proxy.ts):** Runs on every route match, calls `supabase.auth.getUser()` to refresh the session, and propagates cookie changes via `supabaseResponse.cookies.set()`.

### Session Configuration (Supabase Cloud)

| Setting | Value | Notes |
|---------|-------|-------|
| JWT expiry | 3600s (1 hour) | Configurable in `supabase/config.toml` |
| Refresh token rotation | Enabled | Old refresh tokens are invalidated on use |
| Refresh token reuse interval | 10s | Brief grace window for concurrent requests |
| Minimum password length | 6 | Should be raised to 8+ in production |
| Email confirmations | Disabled | Users can sign in immediately after signup |
| MFA (TOTP/Phone/WebAuthn) | Disabled | Not yet implemented |

### API Route Auth Pattern

Every protected API route follows this pattern:

```ts
const cookieStore = await cookies();
const supabase = getServerClient(cookieStore);
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  return errorResponse("UNAUTHORIZED", "User must be signed in", 401);
}
```

This pattern appears in:
- `/api/bookmarks/folders` — all CRUD operations
- `/api/chat` — cloud AI mode and conversation save
- `/api/guidance/sessions` — listing and retrieval
- `/api/settings/api-key` — all operations
- `/api/guidance` — AI path generation with saved sessions

---

## 4. Encryption at Rest

### Overview

User API keys (OpenAI, Anthropic) are encrypted with **AES-256-GCM** before being stored in the `user_api_keys` table. The plaintext key is **never stored or exposed to the client**.

### Implementation (`lib/encryption.ts`)

```ts
Algorithm:    AES-GCM (AES-256-GCM)
Key size:     32 bytes (256 bits)
IV length:    12 bytes (96 bits) — NIST recommended for GCM
Key source:   SERVER_ENCRYPTION_KEY environment variable (64 hex chars)
Output:       JSON blob { iv: "<base64>", ciphertext: "<base64>" }
```

### Key Derivation

```
SERVER_ENCRYPTION_KEY (64 hex chars)
        │
        ▼
Buffer.from(hex, "hex") → Uint8Array(32 bytes)
        │
        ▼
crypto.subtle.importKey("raw", ..., "AES-GCM", false, ["encrypt", "decrypt"])
        │
        ▼
CryptoKey (AES-256-GCM, non-extractable, usable only for encrypt/decrypt)
```

### Encryption Flow

```ts
export async function encryptApiKey(plaintext: string): Promise<string> {
  const raw = getRawKey();                  // 32-byte key from env
  const key = await importKey(raw);          // Import as Web Crypto key
  const iv = crypto.getRandomValues(IV);     // 12 random bytes
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return JSON.stringify({
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  });
}
```

### Decryption Flow

```ts
export async function decryptApiKey(encrypted: string): Promise<string> {
  const payload = JSON.parse(encrypted);     // Parse { iv, ciphertext }
  // Validates both fields are present and are strings
  const raw = getRawKey();                   // Same env-derived key
  const key = await importKey(raw);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(payload.iv) },
    key,
    fromBase64(payload.ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}
```

### Storage

The encrypted payload is stored in `user_api_keys`:

```sql
CREATE TABLE public.user_api_keys (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,         -- JSON { iv: b64, ciphertext: b64 }
  provider      TEXT NOT NULL,         -- 'openai' | 'anthropic' | 'openai-compatible'
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

### Key Rotation

When `SERVER_ENCRYPTION_KEY` is changed:
- Existing encrypted keys can no longer be decrypted (GCM authentication tag validation fails).
- The chat API detects this and shows: *"Your stored API key was encrypted with a previous server encryption key and can no longer be decrypted. Please re-enter your API key in Settings."*
- Users must re-enter their API keys after a server encryption key rotation.
- All `user_api_keys` rows can be purged with `DELETE FROM user_api_keys` after rotation.

### Key Validation

```ts
function getRawKey(): Uint8Array {
  const hex = process.env.SERVER_ENCRYPTION_KEY;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      "SERVER_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)."
    );
  }
  return new Uint8Array(Buffer.from(hex, "hex"));
}
```

A non-hex or wrong-length key causes an immediate, loud failure at startup.

---

## 5. Rate Limiting

### Current Implementation

The application uses a **Supabase-backed sliding-window rate limiter** in `lib/rate-limiter.ts`, replacing the previous per-instance in-memory store.

**How it works:**

1. Client IP is hashed with SHA-256 (truncated to 16 hex chars / 64 bits) for privacy preservation.
2. The hash, endpoint name, and config are sent to the `check_rate_limit()` SECURITY DEFINER PostgreSQL function (migration 00009).
3. The function uses an `INSERT ... ON CONFLICT DO UPDATE` pattern to atomically increment a counter for the current window.
4. If the count exceeds the limit, the function returns `{ allowed: false }`.
5. A **probabilistic cleanup** call (~1-in-20 requests) removes expired windows to prevent unbounded table growth.
6. If Supabase is unavailable, it **falls back to an in-memory Map** (for offline development/testing).

```ts
// Configuration constants
export const DEFAULT_AI_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60_000,       // 10 requests per minute
};

export const DEFAULT_SEARCH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,       // 60 requests per minute
};
```

**Non-AI endpoints** (laws, bookmarks, diagnostics) are **not** rate-limited at the application level (they rely on Supabase's API gateway limits).

### Cleanup

The static `setInterval()` approach was replaced by two mechanisms:

1. **Probabilistic cleanup** (active): Every call to `checkRateLimit()` has a 5% chance of triggering `cleanup_rate_limits(5)` — this deletes windows older than 5 minutes. This scales well because the cleanup is idempotent and cheap.
2. **pg_cron** (preferred for production): If the `pg_cron` extension is available on Supabase, schedule `SELECT cron.schedule('rate-limit-cleanup', '*/5 * * * *', 'SELECT public.cleanup_rate_limits(5)');`. This was not enabled due to the Supabase project being on the Free Plan (pg_cron requires the Pro plan).

### Rate-Limited Endpoints

| Endpoint | Limit | Window | File |
|----------|-------|--------|------|
| `POST /api/chat` | 10 requests | 1 minute | `chat/route.ts` |
| `POST /api/guidance` | 10 requests | 1 minute | `guidance/route.ts` |
| `POST /api/explain` | 10 requests | 1 minute | `explain/route.ts` |
| `GET /api/search` | 60 requests | 1 minute | `search/route.ts` |

### Middleware Rate Limiter (src/proxy.ts)

The proxy/middleware now **delegates** to the shared `checkRateLimit()` from `lib/rate-limiter.ts` instead of maintaining its own in-memory store:

```ts
import { checkRateLimit, getClientIp } from "./lib/rate-limiter";

// Rate limit API chat and explain routes
if (
  request.nextUrl.pathname.startsWith("/api/chat") ||
  request.nextUrl.pathname.startsWith("/api/explain")
) {
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(ip);
  if (!allowed) { return 429 response; }
}
```

The API routes (`/api/chat`, `/api/explain`, `/api/guidance`, `/api/search`) also call `checkRateLimit()` independently. For `/api/chat` and `/api/explain`, the middleware rate-limit check applies **in addition to** the route-level check — meaning both must pass. This is intentional defense-in-depth: the middleware catches uncaught requests before they reach the handler, and the handler validates within its own context.

### Limitations

See [gap 8.1](#81-rate-limiter-migration-complete).

---

## 6. RLS Policy Summary

All user-owned tables have Row Level Security enabled. Below is the complete policy matrix.

### Table: `laws` — Public Read

| Policy | Operation | Rule |
|--------|-----------|------|
| `laws are public` | SELECT | `USING (true)` |

### Table: `bookmarks` — User-Owned

| Policy | Operation | Rule |
|--------|-----------|------|
| `users own bookmarks` | ALL | `USING (auth.uid() = user_id)`<br>`WITH CHECK (auth.uid() = user_id)` |

### Table: `bookmark_folders` — User-Owned

| Policy | Operation | Rule |
|--------|-----------|------|
| `users own folders` | ALL | `USING (auth.uid() = user_id)`<br>`WITH CHECK (auth.uid() = user_id)` |

### Table: `conversations` — User-Owned

| Policy | Operation | Rule |
|--------|-----------|------|
| `users own conversations` | ALL | `USING (auth.uid() = user_id)`<br>`WITH CHECK (auth.uid() = user_id)` |

### Table: `messages` — Via Conversation Ownership

| Policy | Operation | Rule |
|--------|-----------|------|
| `users own messages` | ALL | `USING (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()))`<br>`WITH CHECK (conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid()))` |

### Table: `case_files` — User-Owned

| Policy | Operation | Rule |
|--------|-----------|------|
| `Users own their case files` | ALL | `USING (auth.uid() = user_id)`<br>`WITH CHECK (auth.uid() = user_id)` |

### Table: `guidance_paths` — Via Case File Ownership

| Policy | Operation | Rule |
|--------|-----------|------|
| `users own guidance paths` | ALL | `USING (case_file_id IN (SELECT id FROM case_files WHERE user_id = auth.uid()))`<br>`WITH CHECK (case_file_id IN (SELECT id FROM case_files WHERE user_id = auth.uid()))` |

### Table: `user_api_keys` — User-Owned

| Policy | Operation | Rule |
|--------|-----------|------|
| `users own api key` | ALL | `USING (auth.uid() = user_id)`<br>`WITH CHECK (auth.uid() = user_id)` |

### Table: `norm_explanations` — Public Read/Insert

| Policy | Operation | Rule |
|--------|-----------|------|
| `norm_explanations are public` | SELECT | `USING (true)` |
| `norm_explanations insert` | INSERT | `WITH CHECK (true)` |

### Table: `remediation_playbooks` — Public Read

| Policy | Operation | Rule |
|--------|-----------|------|
| `Playbooks are public` | SELECT | `USING (true)` |

### Table: `document_templates` — Public Read

| Policy | Operation | Rule |
|--------|-----------|------|
| `Templates are public` | SELECT | `USING (true)` |

### Tables Dropped in Migration 00007

The following tables from migration 00005 were removed in migration 00007 (their RLS policies are retained here only for historical reference):

| Table | Policy Pattern |
|-------|---------------|
| `courts` | Authenticated read |
| `profiles` | Authenticated read, self-update |
| `legal_cases` | CRUD — own/admin |
| `case_documents` | CRUD — via legal_cases ownership |
| `case_hearings` | CRUD — via legal_cases ownership |
| `case_parties` | CRUD — via legal_cases ownership |

### Key Design Decisions

1. **Ownership chain for related tables:** `messages` are owned through `conversations`, and `guidance_paths` through `case_files`. This prevents direct access without going through the owning relationship.
2. **Admin override was removed** in migration 00007. Migration 00005 had added admin-role-based policies referencing `public.profiles`, but since no users have profile entries, this code was dead. The policies were reverted to simple `auth.uid() = user_id` checks.
3. **Public tables** (`laws`, `norm_explanations`, `remediation_playbooks`, `document_templates`) allow SELECT for everyone. `norm_explanations` also allows INSERT for everyone (used for caching AI explanations).

---

## 7. Secret Scanning & Supply Chain

### Gitleaks — Pre-Commit Hook

A pre-commit hook at `.githooks/pre-commit` runs **gitleaks** on staged changes:

- **Config:** `.gitleaks.toml` extends the default rules with project-specific patterns:
  - `supabase-service-role-key` — JWT with full DB admin access (critical)
  - `supabase-anon-key` — Publishable Supabase key
  - `qdrant-api-key` — Qdrant Cloud API key
  - `openai-api-key` — OpenAI `sk-*` keys
  - `anthropic-api-key` — Anthropic `sk-ant-*` keys
  - `encryption-key-hardcoded` — `SERVER_ENCRYPTION_KEY` in source
- **Allowlist:** Known false-positive paths are excluded (node_modules, test files, markdown docs, `.next/`, `.worktrees/`, scripts).
- **Install:** `powershell -ExecutionPolicy Bypass -File .githooks\install.ps1` (Windows) or `git config core.hooksPath .githooks` (macOS/Linux).
- **Bypass:** `git commit --no-verify` (emergencies only).

### CI Secret Scanning

- Workflow: `.github/workflows/secrets-scan.yml`
- Action: `gitleaks/gitleaks-action@v2`
- Runs on every push and pull request.
- Catches hardcoded secrets even if the local pre-commit hook is bypassed.

### Dependabot

- Config: `.github/dependabot.yml`
- **npm (nextjs/):** Weekly scans (Monday, 09:00 Europe/Berlin), grouped updates for React, Supabase, Qdrant, TypeScript/ESLint, and testing packages. Major version updates for `next` and `zod` are intentionally ignored (require manual review).
- **GitHub Actions:** Weekly scans, grouped into a single PR.

### Dependency Hygiene

- Lockfile (`package-lock.json`) is committed.
- `postcss` is pinned via `overrides` for security consistency.
- No unverified or suspicious packages in the dependency tree.
- All runtime dependencies are from well-known publishers (`@supabase/*`, `@qdrant/*`, `vercel/next.js`, `react`, `zod`, `lucide-react`, `motion`).

---

## 8. Known Security Gaps

This is an honest assessment of limitations and areas for improvement.

### 8.1 Rate Limiter — Supabase-Backed (Migration Complete)

**Status:** ✅ Mitigated

**Previous Issue:** The rate limiter (`lib/rate-limiter.ts`) used an in-memory `Map<string, RateLimitEntry>`. On Vercel's serverless infrastructure each invocation could run in a different container, making the rate limit state **not shared** across instances.

**Remediation (2026-06-26):**
- Migration `00009_rate_limits.sql` creates a `rate_limits` table in Supabase with `ip_hash`, `endpoint`, `count`, and `window_start` columns.
- A `check_rate_limit()` SECURITY DEFINER stored procedure performs atomic upsert + count in a single query, bypassing RLS.
- `src/lib/rate-limiter.ts` now calls `supabase.rpc('check_rate_limit', ...)` with SHA-256 hashed IPs (first 16 hex chars) for privacy.
- Falls back to in-memory when Supabase is unavailable (local dev, tests).
- Legacy duplicate limiter in `src/proxy.ts` replaced with a delegate to the shared `checkRateLimit()` function.

**Residual risk:**
- If the Supabase database is unreachable, the in-memory fallback kicks in (per-instance).
- The `cleanup_rate_limits()` function needs a periodic cron call (not yet scheduled).

### 8.2 CSP Uses `'unsafe-inline'` and `'unsafe-eval'`

**Severity:** Medium (known tradeoff)

**Issue:** The Content Security Policy includes both `'unsafe-inline'` and `'unsafe-eval'`, which weaken XSS protections.

**Why they are required:**
- `'unsafe-inline'` — Next.js injects inline `<script>` bundles for client-side hydration. Without it, the app would not render. Next.js does not currently support strict CSP with nonces or hashes for all script types (this is being tracked by the Next.js team).
- `'unsafe-eval'` — Required by `@huggingface/transformers` (Transformers.js) which uses `eval()`-like operations to load and execute WebAssembly-based models in the browser.
- `wasm-unsafe-eval` — Required by Transformers.js to load ONNX runtime WASM binaries via WebAssembly.instantiate().
- `blob:` — Required by Transformers.js to create and run WASM modules from dynamically loaded scripts.

**Mitigations in place:**
- React 19 escapes all JSX. No `dangerouslySetInnerHTML` is used.
- `script-src` restricts sources to `'self'`, `blob:`, `cdn.jsdelivr.net`. Arbitrary script injection would still require an attacker to upload a script to a whitelisted origin.
- `connect-src` allows `cdn.jsdelivr.net`, `huggingface.co`, `us.aws.cdn.hf.co` for Transformers.js model/WASM downloads.
- `worker-src` allows `blob:` and HuggingFace CDN for web worker execution.

**Recommendation:**
- If Next.js adds nonce/hash support for all bundle types in the future, migrate away from `'unsafe-inline'`.
- For `'unsafe-eval'`, confine it with a separate policy for the worker scope if possible (via `script-src` attribute on `<script>` tags for the worker entry point).
- Monitor [Next.js CSP documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/contentSecurityPolicy) for strict CSP support.

### 8.3 `img-src` Uses `https:` Wildcard

**Severity:** Low

**Issue:** The CSP allows images from any HTTPS source (`img-src 'self' data: https:`).

**Why it's broad:** The application does not restrict image sources because there's no user-generated image upload feature. All images are static assets bundled with the app.

**Impact:** An attacker who finds an XSS vulnerability could exfiltrate data via image requests to an attacker-controlled server. However, since `connect-src` is also relatively permissive and the app already has `script-src` with `'unsafe-inline'`, this is not the weakest link.

**Recommendation:**
- If images are only from specific sources (e.g., a CDN), restrict `img-src` accordingly.
- This gap is acceptable while `'unsafe-inline'` is in use (see 8.2).

### 8.4 No Dedicated CSRF Tokens

**Severity:** Low-Medium

**Issue:** The application relies on **SameSite cookies** and the **`form-action 'self'` CSP directive** for CSRF protection. There are no explicit CSRF tokens (e.g., double-submit cookies, `X-CSRF-Token` headers) for API routes.

**Why this is acceptable for now:**
- All state-changing API routes require authentication via `supabase.auth.getUser()`. An attacker would need the victim's session cookie (which is HttpOnly + SameSite=Lax) to perform actions.
- `form-action 'self'` prevents HTML form submissions to the API from cross-origin pages.
- The Supabase SSR implementation sends cookies with `SameSite=Lax`.

**Remaining risk:**
- Side-channel attacks or subdomain takeovers that bypass SameSite protections.
- `SameSite=Lax` does not protect against GET-based CSRF (though the app has no state-changing GET handlers).

**Recommendation:**
- Add a CSRF token check for high-value operations (API key management, bookmark deletion).
- Implement using a double-submit cookie pattern or the `csrf` header approach with Supabase's built-in `X-CSRF-Protection` header (available in newer Supabase versions).

### 8.5 Secret Rotation Guidance

**Issue:** The `SERVER_ENCRYPTION_KEY` (AES-256-GCM key for API key encryption) cannot be rotated without user friction — all stored API keys become undecryptable. There is no automated re-encryption mechanism.

**Current behavior on rotation:**
1. `SERVER_ENCRYPTION_KEY` env var is changed.
2. `decryptApiKey()` fails on all existing rows because the GCM authentication tag does not match.
3. The chat/guidance API detects the failure and shows: *"Your stored API key was encrypted with a previous server encryption key..."*
4. Users must re-enter their API key in Settings, which triggers re-encryption with the new key.

**Recommendation:**
- Add a re-encryption script that reads all `user_api_keys`, decrypts with the old key, and re-encrypts with the new key during a maintenance window.
- The re-encryption script should:
  - Be idempotent (can retry safely).
  - Run during low-traffic hours.
  - Log every key re-encrypted without logging the plaintext.
  - Accept the old key via a temporary env var or CLI argument (do not store multiple keys in the main env).
- Consider a key-wrapping scheme: derive a key-encryption key (KEK) from `SERVER_ENCRYPTION_KEY`, and use a random data-encryption key (DEK) per row's key. Rotation only re-encrypts the DEK with the new KEK, not the actual API keys.

### 8.6 No Subresource Integrity (SRI)

**Severity:** Low

**Issue:** Scripts loaded from CDNs (`cdn.jsdelivr.net`, `huggingface.co`) do not have `integrity` attributes for SRI verification.

**Impact:** If a CDN is compromised, injected malicious scripts could execute within the app's CSP-origin context.

**Recommendation:**
- Add `integrity` hashes for all statically known CDN scripts.
- For dynamically loaded scripts (Hugging Face models), this is harder to implement and may require a proxy layer.

### 8.7 Email Confirmation Disabled

**Severity:** Low

**Issue:** `enable_confirmations = false` in Supabase auth config means users can sign up without verifying their email address. This lowers the barrier for attackers to create accounts.

**Recommendation:**
- Enable email confirmation for production: `enable_confirmations = true`.
- Configure an SMTP provider (e.g., SendGrid) in `[auth.email.smtp]` to send confirmation emails.
- The minimum password length should be raised from 6 to at least 8.

### 8.8 SSRF via Broker URL (Mitigated)

**Status:** ✅ Mitigated

**Attack vector:** The broker URL (`settings.brokerUrl`) is user-configurable and stored in `localStorage`. Previously, the application fetched `{brokerUrl}/health` and `{brokerUrl}/api/chat` without validation. An attacker who modified the broker URL to an internal service (e.g., `http://169.254.169.254/latest/meta-data/` for AWS metadata, or `http://internal.corp.service/`) could perform SSRF attacks.

**Remediation (2026-06-26):**
- `chat-context.tsx`: `sanitizeBrokerUrl()` validates broker URL against regex `^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$` on load and on save.
- `page.tsx`: `isValidBrokerUrl()` checked before every `fetch()` to broker endpoints.
- `route.ts` (server-side): `NEXT_PUBLIC_BROKER_URL` validated server-side before use.
- Invalid URLs are silently replaced with `http://localhost:9000` with a console warning.
- No user-facing error or stack trace is leaked on validation failure.

**Residual risk:** None — the regex only allows localhost and IPv4/IPv6 loopback. No internal cloud metadata endpoints, no RFC 1918 internal addresses.

### 8.9 SSRF via Custom API Endpoint (Mitigated)

**Status:** ✅ Mitigated (2026-06-26)

**Attack vector:** In Cloud AI mode with the `openai-compatible` provider, users can specify a custom endpoint URL (`customEndpoint` in settings). This URL was passed directly to `fetch()` in `callOpenAICompatible()` (`src/lib/ai-provider.ts`) without validation. An attacker who compromised a user's settings (via XSS or localStorage injection) could set the endpoint to an internal service (e.g., cloud metadata IP `http://169.254.169.254/`, internal database `http://10.0.0.1:5432/`, or a local service `http://127.0.0.1:3000/`). The server would then make an authenticated request (with the user's API key in the Authorization header) to that internal endpoint.

**Risk factors:**
- This is a **stored SSRF** — the attacker needs XSS or localStorage access to set the endpoint.
- The user's API key would be sent to the attacker-controlled endpoint.
- The server could be used to probe internal networks (metadata APIs, internal services).

**Remediation (2026-06-26):**
- Added `validateEndpointUrl()` in `src/lib/ai-provider.ts` that validates:
  - URL must be valid (parsed by `new URL()`).
  - Protocol must be `http` or `https`.
  - Hostname must NOT be localhost/loopback (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`).
  - Hostname must NOT be in private IP ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`, `169.254.x.x`).
- The validation runs server-side, before the `fetch()` call.
- An invalid endpoint throws a clear error message that is sanitized before reaching the client.

**Residual risk:** Low — hostname-based validation cannot prevent SSRF to arbitrary internet hosts (the endpoint could be any public URL). This is by design (BYO provider model). The critical internal/private ranges are all blocked. For stronger protection, the server could require HTTPS for all custom endpoints, but this would break self-hosted providers that only support HTTP on private networks.

## 9. Security Testing

### Automated Testing

| Test Type | Scope | Run |
|-----------|-------|-----|
| TypeScript strict mode | All code | `npx tsc --noEmit` |
| ESLint | All code | `npm run lint` |
| Vitest | Unit + integration | `npm test` |
| Gitleaks (CI) | Commit contents | Every push/PR |
| Dependabot | Dependency vulns | Weekly |

### Manual Testing Recommendations

1. **Penetration testing:** Before major releases, run:
   - ZAP (Zed Attack Proxy) passive scan against the production URL.
   - `curl`-based IDOR testing: attempt to access another user's bookmarks, conversations, or API key status.

2. **Verification checklist after deployments:**
   - [ ] CSP headers present on all pages (`curl -sI <url> | grep -i content-security-policy`)
   - [ ] HSTS header present for HTTPS redirect.
   - [ ] `frame-ancestors 'none'` prevents iframe embedding.
   - [ ] Cookie attributes: `HttpOnly`, `Secure`, `SameSite=Lax`.
   - [ ] Unauthenticated access to `/api/settings/api-key/status` returns `401`.
   - [ ] Rate limiter headers (`X-RateLimit-Remaining`) present on AI endpoints.

3. **Load testing:**
   - Verify Supabase connection pool (default: 20) is adequate for peak traffic.
   - Verify Qdrant query timeout and concurrency limits.
   - Test shared rate limiter with concurrent requests (should hold across simulated instances).

### Environment Variables Requiring Protection

| Variable | Sensitivity | Exposure |
|----------|-------------|---------|
| `SERVER_ENCRYPTION_KEY` | **Critical** | Server env only |
| `QDRANT_API_KEY` | **High** | Server env only |
| `SUPABASE_SERVICE_ROLE_KEY` | **Critical** | Not used in app; for migrations only |
| `VERCEL_TOKEN` | **High** | CI/CD env only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Low | Public (publishable key) |
| `NEXT_PUBLIC_SUPABASE_URL` | Low | Public (Supabase project URL) |

---

## Appendix: File Reference

| Security Component | Location |
|--------------------|----------|
| CSP + Security headers | `nextjs/next.config.ts` |
| Encryption (AES-256-GCM) | `nextjs/src/lib/encryption.ts` |
| Error sanitization | `nextjs/src/lib/sanitize.ts` |
| Rate limiter (Supabase-backed) | `nextjs/src/lib/rate-limiter.ts` |
| Rate limit migration | `supabase/migrations/00009_rate_limits.sql` |
| SSRF broker validation | `nextjs/src/components/chat-context.tsx` |
| SSRF endpoint validation | `nextjs/src/lib/ai-provider.ts` (validateEndpointUrl) |
| Auth proxy/middleware + rate limit | `nextjs/src/proxy.ts` |
| AI provider implementations | `nextjs/src/lib/ai-provider.ts` |
| Supabase browser client | `nextjs/src/lib/supabase.ts` |
| Supabase server client | `nextjs/src/lib/supabase-server.ts` |
| RLS policies (migrations) | `supabase/migrations/` |
| Full schema + RLS | `supabase/studio-apply-all.sql` |
| Supabase auth config | `supabase/config.toml` |
| Gitleaks rules | `.gitleaks.toml` |
| Dependabot config | `.github/dependabot.yml` |
| Security policy | `.github/SECURITY.md` |
| Vulnerability reporting | [GitHub Advisories](https://github.com/shahriarhaqueabir/AI-Assisted-German-Law/security/advisories/new) |
