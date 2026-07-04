# Sprint 8 Handoff — Onboarding Polish + Translations + Feature Gating

## Problem

The onboarding wizard is wired up but has gaps:
1. Language selection grid shows all 9 languages, but the wizard UI text stays English because all 8 translation stubs spread `...EN`
2. Feature gates exist on bookmark, norm-viewer translate, and guidance submit — but NOT on chat send or guidance retry
3. No async API key status detection, so cloud-mode gates can't check at mount time
4. FeatureGate tooltips show generic messages regardless of mode
5. Search bar has no visual texture/background
6. Home page hardcodes English strings

## State

- **500/518 tests pass** (18 pre-existing norm-viewer failures)
- **TypeScript**: clean (0 errors)
- **Onboarding state**: 6 localStorage keys (`glv_onboarding_*`)
- **ChatSettings**: stored in `glv_chat_settings`, includes `{ mode, language, provider, model, ... }`
- **Auth**: `useAuth()` returns `{ user, loading }`

## Key Files

| Path | Purpose |
|------|---------|
| `src/components/feature-gate.tsx` | FeatureGate component (5 requirements: auth, api-key, ai-mode, ai-mode-local, browser-ai) |
| `src/components/onboarding-context.tsx` | Context + 6 localStorage keys |
| `src/components/onboarding-wizard.tsx` | 4-step wizard (Language, Mode, Features, Complete) |
| `src/components/onboarding-banner.tsx` | Gold ribbon banner |
| `src/app/chat/page.tsx` | Chat page — send button at line 634 |
| `src/app/guidance/page.tsx` | Guidance page — retry button at line 324 |
| `src/app/settings/page.tsx` | Settings — onboarding section at line 276 |
| `src/app/layout.tsx` | Root layout — provider order |
| `src/lib/i18n/` | 9 language files (en.ts = source of truth, 8 stubs = `...EN`) |
| `src/hooks/useLanguage.ts` | `t(key, vars?)` hook |
| `src/lib/types.ts` | AppLanguage, ChatMode, LANGUAGE_LABELS, LANGUAGE_NAMES |
| `src/components/norm-viewer.tsx` | NormViewer with translate button |

## Translation Modes & Requirements

| Mode | API Key Needed? | Works for Norm Translation? | Notes |
|------|----------------|---------------------------|-------|
| Basic | ❌ No | ❌ No | No AI — search only |
| Browser | ❌ No | ✅ Yes | Transformers.js in-browser, ~1GB download |
| Local | ❌ No | ✅ Yes | Ollama via broker.py |
| Cloud | ✅ Yes (OpenAI/Anthropic) | ✅ Yes | BYO API key, billed by provider |

## Onboarding Flow

```
Banner shown (gold ribbon, top of page)
  → "Start Setup" opens wizard
  → Step 1: Language grid (9 options, sets AppLanguage + ChatSettings.language)
  → Step 2: Mode decision tree (API key? → Browser? → Ollama? → recommendation)
  → Step 3: Feature overview (what's unlocked, what needs AI/auth)
  → Step 4: Completion + "Start using the app"
  → Stored to localStorage, banner disappears
```

Users can dismiss at any point. Onboarding is findable in Settings → Onboarding section.

## FeatureGate Requirements

| Requirement | Pass Condition | Action |
|-------------|---------------|--------|
| `auth` | `!!user` | Navigate to `/auth` |
| `api-key` | Has stored API key | Navigate to `/settings` |
| `ai-mode` | `settings.mode !== "basic"` | Navigate to `/settings` |
| `ai-mode-local` | `settings.mode === "local" && brokerAvailable` | Navigate to `/settings` |
| `browser-ai` | `settings.mode === "browser"` | Navigate to `/settings` |

## When Translation Is Triggered

Current flow in NormViewer:
1. User clicks section header → section expands (shows German raw text)
2. User clicks "Translate to [language]" button (below the content)
3. FEATURE GATE: if `settings.mode === "basic"`, shows lock — requires ai-mode
4. If AI mode active: calls browser AI / local broker / cloud API
5. Translation + summary + implications + next_steps rendered below the raw text
6. User can toggle between "Show Translation" / "Show Original German"

The "Translate to [language]" text changes dynamically based on `settings.language`.

## Auto-translate on Expand (O-08)

Currently translation is manual button-click. The request is: when a user expands a section, if AI mode is active, auto-fetch the translation. The existing manual toggle between German/translated text should still work.

Edge cases:
- Cold start: browser AI model might not be loaded yet
- Local: broker might be offline
- Cloud: API key might not be configured
- Network failure during fetch

Proposed approach:
- `onExpandedChange` triggers `fetchExplanation()` if AI mode is active
- If `explaining` state is already true (another section loading), skip
- If fetch fails, show the manual button as fallback (current behavior)

## Reusable Patterns

### i18n key format
```
"namespace.key" — e.g. "onboarding.banner_text", "nav.chat"
```

### Adding a new language string
1. Add to `src/lib/i18n/en.ts` with English value
2. Run translation script to fill all 8 language files
3. Use `t("namespace.key")` in components

### LANGUAGE_MAP fallback chain (in useLanguage.ts)
```
language → LANGUAGE_MAP[language] → if key missing: LANGUAGE_MAP.en[key] → if still missing: raw key
```

### Current translation files
```
en.ts — source of truth (97 keys)
de.ts, tr.ts, ar.ts, fr.ts, es.ts, pl.ts, uk.ts, ru.ts — all ...EN (stubs)
```
