# Sprint 3: Test Hardening & UI Quality

> **For agentic workers:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Get `npm test && npx tsc --noEmit` passing cleanly, fix UI quality issues, and update infrastructure.

**Architecture:** Fix 4 test files (explain, diagnostics, auth-page, guidance) → Fix ~16 tsc errors → Qdrant payload index → UI font/contrast fixes → CONTRIBUTING.md update.

**Tech Stack:** Vitest 4.1+, React Testing Library, Next.js 16, Tailwind CSS 4, TypeScript 5 strict

---

## Kanban Board

```
┌─────────────────────────────────────────────────────────────────────┐
│  TO DO                    │  IN PROGRESS    │  DONE                  │
├───────────────────────────┼─────────────────┼────────────────────────┤
│ Task 3: Fix auth-page     │                 │ Task 1: Fix explain    │
│ Task 4: Fix guidance      │                 │ Task 2: Fix diagnostics│
│ Task 5: Fix tsc errors    │                 │                        │
│ Task 6: Qdrant index      │                 │                        │
│ Task 7: .gitignore fix    │                 │                        │
│ Task 8: UI font sizes     │                 │                        │
│ Task 9: Gold contrast     │                 │                        │
│ Task 10: CONTRIBUTING.md  │                 │                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Task 1: Fix explain.test.ts (2 failing tests)

**Files:**
- Modify: `nextjs/src/app/api/__tests__/explain.test.ts`
- Verify: `nextjs/src/app/api/explain/route.ts`

**Problem:** Tests "cloud mode generates explanation" and "Supabase insert failure is non-fatal" fail because the `@supabase/ssr` mock returns `{ user: null }`, causing `resolveApiKey()` to return empty string → no-key fallback triggers instead of `generateNormExplanation()`.

**Fix:** Override mock auth behavior in those two tests specifically.

- [ ] **Step 1: Read the test file to understand the mock pattern**

The mock in the test uses `vi.hoisted` `mockSupabaseResult` and a thenable pattern. The auth mock at line 38 returns `{ data: { user: null } }`.

- [ ] **Step 2: Add auth override mechanism**

The `mockSupabaseResult` object is hoisted and shared. The `auth.getUser` is mocked at line 38. To make it return a user for specific tests, modify the mock to check a condition from `mockSupabaseResult`. 

**Fix approach:** Add a `user` field to `mockSupabaseResult` that the auth mock reads dynamically.

In `explain.test.ts`, change:
```typescript
const mockSupabaseResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  count: 0,
}));
```
to:
```typescript
const mockSupabaseResult = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  count: 0,
  user: null as Record<string, unknown> | null,
}));
```

Then update the auth mock in the `vi.mock("@supabase/ssr")` block (line 38):
```typescript
auth: { getUser: vi.fn().mockImplementation(() => 
  Promise.resolve({ data: { user: mockSupabaseResult.user } })
)},
```

- [ ] **Step 3: Add `mockSupabaseResult.user` in beforeEach**

In the `beforeEach` at line 57, add:
```typescript
mockSupabaseResult.user = null;
```

- [ ] **Step 4: Set user + keyRow for the two failing tests**

For "cloud mode generates explanation" test (line 92), add before importing POST:
```typescript
mockSupabaseResult.user = { id: "test-user-id" };
```

For "Supabase insert failure is non-fatal" test (line 192), add before importing POST:
```typescript
mockSupabaseResult.user = { id: "test-user-id" };
```

Also need the `from("user_api_keys")` chain to return a keyRow, which means we need to add a `single` mock override for the key lookup. The mock thenable chain needs a branch for `"user_api_keys"`. 

**Alternative simpler approach:** The mock `from()` always returns the same thenable. We need the `user_api_keys` query to not interfere with the `norm_explanations` query. The simplest fix: make `resolveApiKey` return a valid key when user is set, by having the `maybeSingle()` call return key data.

Actually, the cleanest approach: the `resolveApiKey` function queries `from("user_api_keys")` then `.select("*")` then `.eq("user_id", user.id)` then `.maybeSingle()`. All of these return the same thenable (which resolves to `mockSupabaseResult`). So if `mockSupabaseResult.data` has key data, that would interfere with the `norm_explanations` cache check (which also uses the same mock).

The issue is the flat mock - both queries (user_api_keys and norm_explanations) go through the same mock object. We need a way to return different results for different tables.

**Better fix:** Use a queue or state machine in the mock. Replace the single `mockSupabaseResult.data` with an array-based approach.

Actually, the existing pattern works for diagnostics.test.ts because it only does one query. For explain, the first query is the cache check and the second is the API key lookup. Let me think about a simpler approach.

The simplest fix that doesn't change the mock architecture: make the user_api_keys lookup return key data through a secondary hoisted variable that the `from()` mock checks.

Let me add a `keyRow` field to `mockSupabaseResult` and modify the `from()` mock to branch based on table name.

**Change in the mock:**
```typescript
vi.mock("@supabase/ssr", () => {
  const buildThenable = (result: any) => {
    const thenable = Promise.resolve(result);
    return Object.assign(thenable, {
      from: vi.fn((table: string) => {
        if (table === "user_api_keys") {
          const keyResult = { data: result.keyRow || null, error: null };
          const keyThenable = Promise.resolve(keyResult);
          return Object.assign(keyThenable, {
            select: vi.fn(() => keyThenable),
            eq: vi.fn(() => keyThenable),
            maybeSingle: vi.fn(() => keyThenable),
            auth: { getUser: vi.fn().mockImplementation(() =>
              Promise.resolve({ data: { user: result.user } })
            )},
          });
        }
        // Default: return the original thenable
        return thenable;
      }),
      select: vi.fn(() => thenable),
      eq: vi.fn(() => thenable),
      order: vi.fn(() => thenable),
      range: vi.fn(() => thenable),
      limit: vi.fn(() => thenable),
      single: vi.fn(() => thenable),
      insert: vi.fn(() => thenable),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    });
  };
  return { createServerClient: vi.fn(() => buildThenable(mockSupabaseResult)) };
});
```

Hmm, this is getting complex. Let me use the simpler approach that's already working in diagnostics.test.ts - just set a user and see if the test works with the key lookup returning null. The fallback path for no-key in the route already handles this - it returns a basic response without AI. So the tests will need to expect that fallback behavior, OR we need to provide a key row.

Actually looking at the explain route more carefully:

```typescript
// line 221-246
const { apiKey: resolvedKey, provider: resolvedProvider } = await resolveApiKey(supabase);

if (!resolvedKey) {
  // Return basic fallback response
  return NextResponse.json({...});
}

const explanation = await generateNormExplanation({...});
```

If we just set a user but don't have a key row, it falls through to the no-key fallback. The test expects `generateNormExplanation` to be called with the params, which won't happen without a key.

So we ALSO need to provide a key row. Let me use a simpler approach: add a `keyRow` to `mockSupabaseResult` and branch the `from()` mock.

Actually, the simplest approach that works: use two separate hoisted variables, and make the mock check which table is being queried.

- [ ] **Step 5: Implement the fix**

Replace the mock block with a version that branches on table name and supports user auth:

```typescript
// In the vi.mock("@supabase/ssr") block:
// Change from simple thenable to table-aware thenable
```

- [ ] **Step 6: Run tests and verify**

```bash
cd nextjs && npx vitest run src/app/api/__tests__/explain.test.ts
```
Expected: 7/7 tests passing.

---

### Task 2: Fix diagnostics.test.ts (1 failing test)

**Files:**
- Modify: `nextjs/src/app/api/__tests__/diagnostics.test.ts`
- Verify: `nextjs/src/app/api/diagnostics/route.ts`

**Problem:** Test "Supabase failure returns overall 500 with partial error" expects `message` to be "Supabase query failed" but `sanitizeErrorMessage` returns something different because of the mock error object.

**Root cause:** In `diagnostics/route.ts` line 39-41:
```typescript
} catch (err: unknown) {
  const message = sanitizeErrorMessage(err);
  checks.supabase = { status: "error", message };
}
```
The `err` is the thrown error from Supabase mock. When `mockSupabaseResult.error = { message: "Permission denied" }` and the mock doesn't actually throw, the catch block doesn't trigger correctly.

Looking at the route, the catch happens because `if (error) throw error;` at line 34 throws the error object. `sanitizeErrorMessage(err)` is called with the thrown error.

The mock error object `{ message: "Permission denied" }` when thrown becomes the err in catch. `sanitizeErrorMessage` does `error instanceof Error ? error.message : String(error)`. Since `{ message: "Permission denied" }` is NOT an instance of Error, it does `String(error)` which gives `"[object Object]"`.

**Fix:** Change mock from `{ message: "Permission denied" }` to `new Error("Supabase query failed")`.

Or alternatively, change the test expectation from "Supabase query failed" to "Permission denied" since that's what sanitize returns for the plain object.

Let me use `new Error(...)` approach since the route expects a real Error.

- [ ] **Step 1: In diagnostics.test.ts line 91, change:**
```typescript
mockSupabaseResult.error = { message: "Permission denied" };
```
to:
```typescript
mockSupabaseResult.error = new Error("Supabase query failed");
```

- [ ] **Step 2: Also update line 118:**
```typescript
mockSupabaseResult.error = { message: "DB down" };
```
to:
```typescript
mockSupabaseResult.error = new Error("DB down");
```

- [ ] **Step 3: Verify the diagnostics route's catch block**
The route at line 33-34 does:
```typescript
const { data, error } = await supabase.from("laws").select("count").limit(1);
if (error) throw error;
```
Since the mock thenable resolves with `mockSupabaseResult`, `error` will be the Error we set, it gets thrown, and `sanitizeErrorMessage` returns `err.message`.

- [ ] **Step 4: Run tests**
```bash
cd nextjs && npx vitest run src/app/api/__tests__/diagnostics.test.ts
```
Expected: 5/5 tests passing.

---

### Task 3: Fix auth-page.test.tsx (11 failing tests)

**Files:**
- Modify: `nextjs/src/app/__tests__/auth-page.test.tsx`

**Problem:** All 11 tests fail with `useChat must be used within a ChatProvider`. The `auth/page.tsx` component uses `useChat` from `chat-context.tsx` (likely through `useLanguage`).

**Fix:** Mock `useChat` from `chat-context.tsx` at the top of the test file, OR wrap in `ChatProvider`.

**Approach:** Add a vi.mock for `chat-context` that returns a mock `useChat` with the needed properties.

First, read the test file to see current setup.

- [ ] **Step 1: Read the test file**
```bash
cat test file
```

- [ ] **Step 2: Add mock for chat-context**
The auth page likely uses `useLanguage` which calls `useChat()`. We need:
```typescript
vi.mock("../../components/chat-context", () => ({
  useChat: vi.fn().mockReturnValue({
    settings: { language: "en" },
    updateSettings: vi.fn(),
  }),
  ChatProvider: ({ children }: { children: React.ReactNode }) => children,
}));
```

- [ ] **Step 3: Run tests**
```bash
cd nextjs && npx vitest run src/app/__tests__/auth-page.test.tsx
```
Expected: 11/11 tests passing.

---

### Task 4: Fix guidance.test.ts (4 failing tests)

**Files:**
- Modify: `nextjs/src/app/api/__tests__/guidance.test.ts`
- Verify: `nextjs/src/app/api/guidance/route.ts`

**Problem:** Guidance tests fail because the Qdrant search mock isn't returning data and the auth/user mock doesn't have the right setup. Need to read the test file to understand the exact mocking pattern.

- [ ] **Step 1: Read the test file to understand current mock setup**

- [ ] **Step 2: Ensure Qdrant search mock returns results and auth mock returns user with API key**

- [ ] **Step 3: Run tests**
```bash
cd nextjs && npx vitest run src/app/api/__tests__/guidance.test.ts
```
Expected: All guidance tests pass.

---

### Task 5: Fix tsc errors (~16 errors)

**Files:**
- Likely: `nextjs/src/app/chat/[id]/page.tsx`, `nextjs/src/app/guidance/page.tsx`

- [ ] **Step 1: Run tsc and capture current errors**
```bash
cd nextjs && npx tsc --noEmit 2> tsc-errors.txt
```

- [ ] **Step 2: Read error dump and categorize by file**

- [ ] **Step 3: Fix each category of error**

- [ ] **Step 4: Re-run tsc to verify**
```bash
cd nextjs && npx tsc --noEmit
```
Expected: 0 errors.

---

### Task 6: Create Qdrant payload index script

**Files:**
- Create: `nextjs/scripts/create-qdrant-index.js`

Create a script that creates a keyword payload index on `law_key` in the `german_norms` Qdrant collection.

```javascript
#!/usr/bin/env node
/**
 * Create a keyword payload index on law_key in the german_norms collection.
 * This speeds up scroll queries used by GET /api/laws/[key].
 */
const { QdrantClient } = require("@qdrant/js-client-rest");

async function main() {
  const url = process.env.QDRANT_URL;
  const apiKey = process.env.QDRANT_API_KEY;
  if (!url || !apiKey) {
    console.error("Error: QDRANT_URL and QDRANT_API_KEY must be set");
    process.exit(1);
  }

  const client = new QdrantClient({ url, apiKey });
  const collection = process.env.COLLECTION || "german_norms";

  try {
    await client.createPayloadIndex(collection, {
      field_name: "law_key",
      field_type: "keyword",
    });
    console.log(`✓ Payload index created on law_key in ${collection}`);
  } catch (err) {
    if (err.message?.includes("already exists")) {
      console.log(`- Index on law_key already exists in ${collection}`);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
```

- [ ] **Step 1: Create the script file**
- [ ] **Step 2: Add script to CONTRIBUTING.md docs**
- [ ] **Step 3: Test script works (dry run if Qdrant not accessible)**

---

### Task 7: Fix .gitignore for .env.example

**Files:**
- Modify: `nextjs/.gitignore`

**Problem:** `.gitignore` has `.env*` on line 33, which excludes `.env.example` from being committed.

**Fix:** Change `.env*` to `.env` to only exclude the exact `.env` file, or use explicit negative patterns.

```gitignore
# env files (can opt-in for committing if needed)
.env
.env.local
.env.production
.env.development
```

Or simpler:
```gitignore
# env files
.env
.env.*.local
```

But best approach — use explicit negation for `.env.example`:
```gitignore
# env files
.env*
!.env.example
```

- [ ] **Step 1: Update .gitignore**
- [ ] **Step 2: Verify .env.example is tracked**
```bash
cd nextjs && git check-ignore .env.example
```
Should NOT match (exit code 1 means not ignored).

---

### Task 8: Fix sub-10px font sizes

**Files to modify (text-[10px] or text-[11px] → text-xs or larger):**
1. `nextjs/src/app/api-docs/page.tsx` — SwaggerUI overrides (`text-[10px]`)
2. `nextjs/src/app/bookmarks/page.tsx` — badges, labels, metadata
3. `nextjs/src/app/chat/[id]/page.tsx` — mode badges, loading indicators
4. `nextjs/src/app/chat/error.tsx` — CTA buttons
5. `nextjs/src/app/chat/page.tsx` — mode badges
6. `nextjs/src/app/guidance/page.tsx` — likely similar patterns
7. `nextjs/src/components/nav-bar.tsx` — likely small text

**Fix pattern:**
- `text-[10px]` → `text-xs` (12px) for readability
- `text-[11px]` → `text-xs` (12px) or `text-sm` (14px) depending on context

For SwaggerUI overrides, these may need care since Swagger has its own sizing. But `text-[10px]` for Swagger method badges is actually a common pattern — these are tiny labels like "GET", "POST". Still, `text-xs` (12px) would be more readable.

- [ ] **Step 1: Find all text-[10px] and text-[11px] in .tsx files**
- [ ] **Step 2: Replace with appropriate tailwind size**
  - Decorative/metadata: `text-xs`  
  - Body text: `text-sm`
  - Button text: `text-xs`
- [ ] **Step 3: Verify no visual breakage by scanning files**

---

### Task 9: Fix gold contrast issues

**Files to modify:** All places using `text-accent-gold` (#8a7b63) for readable text content.

**Problem:** `accent-gold` (#8a7b63) on `bg-primary` (#050505) has a contrast ratio of approximately **3.8:1**, which fails WCAG AA for text under 18px bold / 24px regular (minimum 4.5:1).

**Fix patterns:**
- For readable body/small text: use `text-accent-gold-body` (#a38a4a) — WCAG AA 4.5:1 on #050505
- For decorative/icons: `text-accent-gold` is fine
- For hover states: `text-accent-gold-bright` (#c5a059) is fine
- For badges with gold background: ensure text contrast using `text-black` or use the body-safe gold

- [ ] **Step 1: Audit all `text-accent-gold` usages**
- [ ] **Step 2: Categorize each as decorative vs readable**
- [ ] **Step 3: Replace readable text usages with `text-accent-gold-body`**
- [ ] **Step 4: For `bg-accent-gold` buttons with white text, verify contrast**

---

### Task 10: Rewrite CONTRIBUTING.md

**Files:**
- Modify: `CONTRIBUTING.md`

Update to reflect current project state (migrations to 00008, ai-provider.ts, rate limiting, test patterns, etc.)

- [ ] **Step 1: Read current CONTRIBUTING.md**
- [ ] **Step 2: Add sections for:**
  - Environment setup with .env.example
  - Migration 00008 (updated_at triggers)
  - ai-provider.ts shared lib pattern
  - Rate limiter architecture
  - Test mock pattern (thenable pattern)
  - Qdrant payload index setup
  - i18n string contribution guide
- [ ] **Step 3: Write updated CONTRIBUTING.md**
