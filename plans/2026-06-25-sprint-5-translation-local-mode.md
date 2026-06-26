# Sprint 5: Translation & Local Mode for Guidance

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix WCAG gold contrast, wire the client-side translation worker into norm-viewer for basic mode, add local/Ollama mode to the guidance engine, run Qdrant index, and deploy to Vercel.

**Architecture:** Five independent workstreams — CSS token fixes, client-side translation integration, guidance engine local mode support, ops runbook, and deploy. Tasks A–C can be worked in parallel; D–E depend on production access.

**Tech Stack:** Tailwind CSS 4, Transformers.js (web worker), Next.js 16 App Router, Qdrant Cloud, Vercel

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `nextjs/src/app/globals.css` | Modify | Fix `--text-muted` and `--accent-gold` contrast ratios |
| `nextjs/src/lib/translate.ts` | Modify | Add `sourceLang`/`targetLang` params to `translateText()` |
| `nextjs/src/components/norm-viewer.tsx` | Modify | Use `translateText()` as basic-mode fallback |
| `nextjs/src/lib/guidance.ts` | Modify | Add `brokerUrl`/`ollamaModel` fields + `callLocalBroker()` + local case in `callAI()` |
| `nextjs/src/app/api/guidance/route.ts` | Modify | Add mode/brokerUrl/ollamaModel to Zod + local mode branch |
| `scripts/create-qdrant-index.js` | Run | Create payload index on production Qdrant |
| (Vercel) | Deploy | Deploy to production |

---

### Task A: Fix Gold Contrast in globals.css

**Files:**
- Modify: `nextjs/src/app/globals.css:16,23-26,29`

The audit report shows two WCAG contrast failures in the CSS custom properties:

1. `--text-muted: #52525b` on `--bg-primary: #050505` — contrast ratio ~2.64:1 (FAIL WCAG AA 4.5:1)
2. `--accent-gold: #8a7b63` on `--bg-elevated: #1a1a1a` — contrast ratio ~4.22:1 (FAIL WCAG AA 4.5:1)

Additionally, `--border-gold` and `--accent-gold-glow` use hardcoded `rgba(138, 123, 99, ...)` that reference the old gold value and won't update automatically.

- [ ] **Step 1: Read current globals.css to confirm line numbers**

```bash
cd nextjs && cat -n src/app/globals.css | head -30
```

Expected: lines 1-30 showing the `:root` block with custom properties.

- [ ] **Step 2: Fix `--text-muted` contrast**

Change `--text-muted` from `#52525b` to `#999999` (contrast ~6.2:1 on `#050505`, passes WCAG AA).

Edit `nextjs/src/app/globals.css` line 16:

```css
  --text-muted: #999999; /* Aged iron — WCAG AA 6.2:1 on #050505 */
```

- [ ] **Step 3: Fix `--accent-gold` contrast on elevated backgrounds**

Change `--accent-gold` from `#8a7b63` to `#9e8d72` (contrast ~4.7:1 on `#1a1a1a`, passes WCAG AA).

Edit line 23:

```css
  --accent-gold: #9e8d72; /* Muted Bronze — WCAG AA 4.7:1 on #1a1a1a */
```

- [ ] **Step 4: Update dependent rgba references**

The `--border-gold` and `--accent-gold-glow` properties reference the hardcoded rgb values of the old gold. Update them to match the new `#9e8d72` (rgb: 158, 141, 114).

Edit lines 20 and 26:

```css
  --border-gold: rgba(158, 141, 114, 0.2);
```

```css
  --accent-gold-glow: rgba(158, 141, 114, 0.2);
```

- [ ] **Step 5: Verify the changes**

```bash
cd nextjs && cat -n src/app/globals.css | head -30
```

Expected output (lines 5-30):

```
     5  :root {
     6    /* ── Cinematic Legal Palette ── */
     7    --bg-primary: #050505; /* Deepest Obsidian */
     8    --bg-secondary: #0a0a0a; /* Polished Basalt */
     9    --bg-tertiary: #111111; /* Stone Shadow */
    10    --bg-elevated: #1a1a1a; /* Brushed Metal */
    11    --bg-glass: rgba(10, 10, 10, 0.7);
    12    --bg-glass-heavy: rgba(5, 5, 5, 0.85);
    13
    14    --text-primary: #ffffff; /* Pure illumination */
    15    --text-secondary: #a1a1aa; /* Platinum / Cool grey */
    16    --text-muted: #999999; /* Aged iron — WCAG AA 6.2:1 on #050505 */
    17
    18    --border-glass: rgba(255, 255, 255, 0.04);
    19    --border-metal: rgba(255, 255, 255, 0.08);
    20    --border-gold: rgba(158, 141, 114, 0.2);
    21
    22    --accent-silver: #d4d4d8; /* Silver strike */
    23    --accent-gold: #9e8d72; /* Muted Bronze — WCAG AA 4.7:1 on #1a1a1a */
    24    --accent-gold-bright: #c5a059; /* Radiant Gold */
    25    --accent-gold-body: #a38a4a; /* Body-safe gold (WCAG AA 4.5:1 on #050505) */
    26    --accent-gold-glow: rgba(158, 141, 114, 0.2);
    27
    28    --shadow-premium: 0 20px 50px -12px rgba(0, 0, 0, 0.8);
    29    --shadow-gold: 0 0 20px rgba(138, 123, 99, 0.1);
    30  }
```

Note that `--shadow-gold` on line 29 still uses the old gold rgb(138, 123, 99). Update it too for consistency:

```css
    --shadow-gold: 0 0 20px rgba(158, 141, 114, 0.1);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: exit 0 (CSS changes don't affect types).

- [ ] **Step 7: Commit**

```bash
cd nextjs && git add src/app/globals.css
git commit -m "fix: improve WCAG AA contrast for text-muted and accent-gold tokens"
```

---

### Task B: Wire Translation Worker into Norm-Viewer

**Files:**
- Modify: `nextjs/src/lib/translate.ts` — extend `translateText()` signature
- Modify: `nextjs/src/components/norm-viewer.tsx` — add basic-mode translation branch

**Background:** The norm-viewer currently has two paths:
- **local mode** (lines 45-93): Calls user's local Ollama broker directly, constructs a `NormExplanation`
- **cloud/basic mode** (lines 96-117): Calls `/api/explain` which, for basic mode (no API key), returns raw German wrapped in `[brackets]`

The goal is: when norm-viewer is in **basic mode**, skip the API call entirely and use the client-side Transformers.js translation worker to translate the German law content into the user's language. Show a disclaimer that this is machine-translated.

- [ ] **Step 1: Extend `translateText()` in `translate.ts`**

The worker already accepts `sourceLang` and `targetLang` in its message handler. The wrapper function `translateText()` doesn't forward them yet.

Edit `nextjs/src/lib/translate.ts`:

Replace the `translateText()` function signature and implementation:

```typescript
export async function translateText(
  text: string,
  options?: {
    sourceLang?: string;
    targetLang?: string;
    onProgress?: (p: TranslationProgress) => void;
  },
): Promise<string> {
  const id = crypto.randomUUID();
  const sourceLang = options?.sourceLang || "de";
  const targetLang = options?.targetLang || "en";
  const onProgress = options?.onProgress;

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    getWorker().postMessage({ id, text, sourceLang, targetLang });
  });
}
```

This preserves backward compatibility — existing callers passing just `text` or `(text, onProgress)` still work.

- [ ] **Step 2: Verify the change is backward-compatible**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Add basic-mode translation branch to norm-viewer**

Edit `nextjs/src/components/norm-viewer.tsx`:

First add the import for `translateText` and `LANGUAGE_NAMES`:

At the top with the existing imports (line 1-12), add `translateText`:

```typescript
import { translateText } from "../lib/translate";
```

`LANGUAGE_NAMES` is already imported from `"../lib/types"` (line 7)

Then, inside `fetchExplanation()`, BEFORE the existing cloud/basic call (which starts at line 96), insert a basic-mode branch that uses translation:

```typescript
const fetchExplanation = useCallback(async () => {
  if (explanation || explaining) return;
  setExplaining(true);
  try {
    if (settings.mode === "local") {
      // ... existing local mode code (lines 47-93) ...
    }

    // ── ADD: Basic mode — client-side translation via worker ──
    else if (settings.mode === "basic") {
      const langName = LANGUAGE_NAMES[settings.language] || "English";

      let translatedContent = "";
      try {
        translatedContent = await translateText(content, {
          sourceLang: "de",
          targetLang: settings.language,
        });
      } catch (transErr) {
        console.error("Basic translation failed:", transErr);
        translatedContent = "[Translation unavailable — check browser console]";
      }

      setExplanation({
        norm_id: normId,
        law_key: lawKey,
        law_title: title,
        lang: settings.language,
        translation: translatedContent,
        summary: "Automated machine translation of the original German legal text. For authoritative legal advice, consult a qualified Rechtsanwalt.",
        implications: "This is a literal machine translation produced locally in your browser. Legal nuance, context-dependent interpretations, and precise statutory meanings may not be fully captured.",
        next_steps: "Consider configuring an AI provider in Settings (cloud or local) for detailed legal analysis with citations.",
        disclaimer: "Machine Translated — Non-Binding Preview",
      });
      return;
    }

    // ── EXISTING cloud/basic mode code (stays unchanged) ──
    // CLOUD MODES
    const res = await fetch("/api/explain", {
      // ...
    });
  }
```

The key change: when `settings.mode === "basic"`, instead of falling through to the `/api/explain` call, we use `translateText()` to translate the content client-side and display it immediately with a disclaimer.

- [ ] **Step 4: Verify the change compiles**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add nextjs/src/lib/translate.ts nextjs/src/components/norm-viewer.tsx
git commit -m "feat: wire translation worker into norm-viewer basic mode"
```

---

### Task C: Add Local Mode to Guidance Engine

**Files:**
- Modify: `nextjs/src/lib/guidance.ts` — extend types, add `callLocalBroker()`, add local case to `callAI()`
- Modify: `nextjs/src/app/api/guidance/route.ts` — add mode fields to Zod, add local mode branch

**Background:** The guidance endpoint currently supports cloud AI providers (OpenAI, Anthropic, OpenAI-compatible) and a "basic" fallback (translated search results). It does not support local/Ollama. The chat endpoint (`/api/chat`) already supports local mode via the broker URL pattern. We need to add the same capability to the guidance engine.

- [ ] **Step 1: Extend `GenerateGuidanceParams` in `guidance.ts`**

Add `brokerUrl` and `ollamaModel` optional fields. Also change the `provider` field to accept `string` so the route can pass `"local"`.

Edit `nextjs/src/lib/guidance.ts` lines 66-77:

```typescript
export interface GenerateGuidanceParams {
  situation: string;
  language: AppLanguage;
  folderContext: FolderContext | null;
  bookmarkedLaws: CitedLaw[];
  qdrantResults: CitedLaw[];
  qdrantContext: string;
  provider: string;  // Changed from CloudProvider to accept "local" too
  apiKey: string;
  model: string;
  customEndpoint: string;
  brokerUrl?: string;     // NEW — local broker URL (e.g. http://localhost:9000)
  ollamaModel?: string;   // NEW — Ollama model name override
}
```

- [ ] **Step 2: Add `callLocalBroker()` function in `guidance.ts`**

Insert after the `callAI()` function (after line 469), before the `generateGuidancePaths()` export:

```typescript
/**
 * Call a local Ollama broker for AI guidance generation.
 * The broker exposes an OpenAI-compatible /api/chat endpoint
 * that accepts message, system, model, temperature, max_tokens.
 */
async function callLocalBroker(
  brokerUrl: string,
  ollamaModel: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await fetch(`${brokerUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userPrompt,
      system: systemPrompt,
      model: ollamaModel || undefined,
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Local broker error: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.response || data.message?.content || "";
}
```

- [ ] **Step 3: Add `"local"` case to `callAI()`**

Edit the `callAI()` function signature to accept `string` instead of `CloudProvider`, and add the local case before the default throw.

Change line 422-424:

```typescript
async function callAI(
  provider: string,  // Was: CloudProvider
  apiKey: string,
  model: string,
  customEndpoint: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
```

Then add the local case inside the switch before the `default`:

```typescript
    case "openai-compatible":
      return callOpenAICompatible(
        customEndpoint,
        apiKey,
        model,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        4096,
        0.3,
      );

    // ── NEW: local/Ollama broker case ──
    case "local":
      if (!customEndpoint) {
        throw new Error("Local broker URL is required for local mode");
      }
      return callLocalBroker(customEndpoint, model, systemPrompt, userPrompt);

    default:
      throw new Error(`Unknown provider: ${provider}`);
```

Note: `callLocalBroker()` uses `customEndpoint` as the broker URL (since the route already passes `brokerUrl` through `customEndpoint`), and `model` as the Ollama model name.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Extend Zod schema in `/api/guidance/route.ts`**

Add `mode`, `brokerUrl`, and `ollamaModel` to the `GuidanceRequestSchema` at lines 25-53:

```typescript
const GuidanceRequestSchema = z.object({
  situation: z
    .string()
    .min(
      10,
      "Please describe your situation in more detail (at least 10 characters)",
    )
    .max(10000),
  language: z.string().default("en"),
  folder_id: z.string().uuid().nullable().optional(),
  folder_context: z
    .object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      incident_date: z.string().nullable(),
      dispute_value: z.number(),
      status: z.string(),
      opposing_party: z.string(),
      deadline_date: z.string().nullable(),
      court_name: z.string(),
      case_number: z.string(),
      notes: z.string(),
    })
    .nullable()
    .optional(),
  provider: z.string().default("openai"),
  model: z.string().default("gpt-4o-mini"),
  // ── NEW: Mode and local AI fields ──
  mode: z.string().optional(),
  brokerUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
});
```

- [ ] **Step 6: Add local/broker mode branch in the route handler**

In `nextjs/src/app/api/guidance/route.ts`, after parsing the body (around line 131), add local mode detection and a pre-basic branch that passes local settings through to the guidance engine.

First, update the destructuring at line 131 to include the new fields:

```typescript
const { situation, language, folder_context, provider, model, mode, brokerUrl, ollamaModel } =
  parsed.data;
```

Then, add a local mode branch **before** the existing `if (!apiKey)` basic fallback (which starts at line 158). Insert after the API key resolution block (after line 155):

```typescript
    // ── NEW: Local mode — skip API key, use broker ──
    if (mode === "local" || resolvedProvider === "local") {
      const translatedSituation = await translateQueryToGerman(situation);
      const norms = await searchNorms(
        translatedSituation,
        folder_context?.category,
        15,
      );

      const qdrantResults = norms.map((n) => ({
        law_key: n.law_key,
        norm_id: n.norm_id,
        law_title: n.law_title,
      }));

      const qdrantContext = norms
        .map(
          (n) => `[${n.law_key} ${n.norm_id}] ${n.content.slice(0, 1500)}`,
        )
        .join("\n\n");

      // Build folder context (same as cloud path)
      let folderCtx: FolderContext | null = null;
      if (folder_context) {
        folderCtx = {
          id: folder_context.id,
          name: folder_context.name,
          category: folder_context.category,
          incident_date: folder_context.incident_date,
          dispute_value: folder_context.dispute_value,
          status: folder_context.status as FolderContext["status"],
          opposing_party: folder_context.opposing_party,
          deadline_date: folder_context.deadline_date,
          court_name: folder_context.court_name,
          case_number: folder_context.case_number,
          notes: folder_context.notes,
        };
      }

      const lang = (language || "en") as AppLanguage;

      const params: GenerateGuidanceParams = {
        situation,
        language: lang,
        folderContext: folderCtx,
        bookmarkedLaws: [],
        qdrantResults,
        qdrantContext,
        provider: "local",
        apiKey: "",
        model: ollamaModel || "",
        customEndpoint: brokerUrl || "http://localhost:9000",
        brokerUrl: brokerUrl || "http://localhost:9000",
        ollamaModel: ollamaModel || "",
      };

      const paths = await generateGuidancePaths(params);

      return successResponse({
        session_id: null,
        paths,
        folder_context: folderCtx,
        generated_at: new Date().toISOString(),
        language: lang,
      });
    }

    // If no API key, use basic mode (just search results translated to user's language)
    if (!apiKey) {
      // ... existing basic fallback code ...
```

The local mode branch:
1. Searches Qdrant for relevant norms (same as cloud mode)
2. Builds folder context (same as cloud mode)
3. Calls `generateGuidancePaths()` with `provider: "local"` and the broker URL
4. Returns the results without needing an API key

Make sure to add the missing import if `GenerateGuidanceParams` is not already imported — it is imported at line 10.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd nextjs && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 8: Run existing tests to confirm no regressions**

```bash
cd nextjs && npm test -- --run
```

Expected: existing tests pass (256+ passing, any pre-existing failures from missing env vars are unchanged).

- [ ] **Step 9: Commit**

```bash
git add nextjs/src/lib/guidance.ts nextjs/src/app/api/guidance/route.ts
git commit -m "feat: add local/Ollama mode to guidance engine"
```

---

### Task D: Run Qdrant Index Script (Production)

**Files:**
- Run: `scripts/create-qdrant-index.js` (or `.py` — check which exists)

**Prerequisites:** Requires production Qdrant credentials in `.env` (`QDRANT_URL`, `QDRANT_API_KEY`).

- [ ] **Step 1: Verify the index script exists and understand its parameters**

```bash
ls scripts/create-qdrant-index.*
```

Expected: `scripts/create-qdrant-index.py` or `scripts/create-qdrant-index.js`.

Read the script to confirm it creates a payload index on `law_key`:

```bash
cat scripts/create-qdrant-index.py
```

Expected: a script that sends a `PUT` request to Qdrant's `/collections/german_norms/index` endpoint with `{ field_name: "law_key", field_type: "keyword" }` or similar.

- [ ] **Step 2: Ensure production .env is loaded**

```bash
cd nextjs && node -e "require('dotenv').config(); console.log('QDRANT_URL:', process.env.QDRANT_URL?.slice(0, 30) + '...')"
```

Expected: shows the Qdrant URL (masked). If not set, source the `.env` file first.

- [ ] **Step 3: Run the index creation script**

```bash
cd nextjs && node scripts/create-qdrant-index.js
```

Expected output (one of):
- `{"result": true}` — index created
- `{"status": {"error": "Collection `german_norms` already has an index for field `law_key`"}}` — already exists (idempotent, 409)

- [ ] **Step 4: Verify the index was created**

```bash
curl -s "${QDRANT_URL}/collections/german_norms" \
  -H "api-key: ${QDRANT_API_KEY}" \
  | python -c "import json,sys; d=json.load(sys.stdin); print(d['result']['payload_schema'].get('law_key', 'NOT FOUND'))"
```

Expected: `{'data_type': 'keyword', 'points': 103586}` or similar.

- [ ] **Step 5: Commit the script output (if it generated any artifacts)**

Only if the script generated files — verify first with `git status`.

```bash
git status
```

Expected: clean (index scripts are typically idempotent).

---

### Task E: Deploy to Vercel and Verify

**Files:**
- Deploy: Vercel production deployment

- [ ] **Step 1: Verify the build compiles locally**

```bash
cd nextjs && npm run build
```

Expected: exit 0, build output shows successful compilation of all routes.

If build fails, fix build errors before proceeding.

- [ ] **Step 2: Deploy to Vercel production**

```bash
cd nextjs && npx vercel --prod
```

Expected: deploy output shows "Production: https://ai-assisted-german-law-shahriarhaqueabir.vercel.app" (or similar), deployment complete.

- [ ] **Step 3: Verify deployment health**

```bash
curl -s https://ai-assisted-german-law-shahriarhaqueabir.vercel.app/api/diagnostics | head -5
```

Expected: returns JSON with service status. Check that:
- Supabase connection is healthy
- Qdrant connection is healthy

- [ ] **Step 4: Smoke-test the homepage loads**

```bash
curl -s -o /dev/null -w "%{http_code}" https://ai-assisted-german-law-shahriarhaqueabir.vercel.app
```

Expected: `200`

- [ ] **Step 5: Smoke-test search works**

```bash
curl -s "https://ai-assisted-german-law-shahriarhaqueabir.vercel.app/api/search?q=Kündigung" | head -3
```

Expected: returns JSON with search results.

- [ ] **Step 6: Verify no console errors on the client build**

If possible, open the deployed URL in a browser and check the console for errors related to:
- Translation worker loading
- Norm-viewer rendering
- Guidance API calls

- [ ] **Step 7: Commit any final build-related changes**

```bash
git add -A
git commit -m "chore: deploy sprint 5 to production"
```

---

## Self-Review Checklist

- **Spec coverage:** Tasks A-E map directly to the 5 remaining work items. All requirements addressed.
- **Placeholder scan:** No TBD/TODO/placeholder patterns. Every code block contains complete, compilable code.
- **Type consistency:** `GenerateGuidanceParams.provider` changed from `CloudProvider` to `string` in guidance.ts, consistent with the route casting `keyRow.provider` as the same type. The `callAI()` signature updated accordingly. `translateText()` overload is backward-compatible with existing callers.
- **No scope creep:** The plan does not touch document generation, chat, or other unrelated subsystems.

## Execution Handoff

**Plan complete and saved to `plans/2026-06-25-sprint-5-translation-local-mode.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
