# Onboarding System Design — German Law Vault

**Date**: 2026-07-04
**Status**: Draft
**Author**: Zed Agent

---

## 1. Overview

This spec describes four interconnected systems that together provide a guided first-use experience, clear feature availability signals, and a multilingual interface for the German Law Vault application.

### Sub-Projects

| Priority | System | Scope | Dependencies |
|----------|--------|-------|--------------|
| 1 | Language UI Translation | 75 UI strings × 9 languages | None |
| 2 | Onboarding Wizard | Full-screen wizard with decision tree | Sub-project 1 (wizard uses translated strings) |
| 3 | Feature Gating | Lock icons + tooltips on gated features | None (independent) |
| 4 | Section Translation UX | Manual translate trigger on law sections | None |

---

## 2. Language UI Translation

### Problem

The `useLanguage()` hook returns only English strings via `t()`. Switching `settings.language` between 9 languages changes AI prompt language and translation target, but the entire UI stays in English. Users cannot tell that language switching "works" for anything.

### Solution: Static Translation Maps

Create one file per language containing a flat key→string map of the ~75 UI strings. The `useLanguage()` hook selects the correct map at runtime with English as the fallback for missing keys.

### File Structure

```
src/lib/i18n/
  index.ts          # exports t() function, LANGUAGE_MAP
  en.ts             # source of truth (current UI_STRINGS)
  de.ts             # German translations
  tr.ts             # Turkish
  ar.ts             # Arabic
  fr.ts             # French
  es.ts             # Spanish
  pl.ts             # Polish
  uk.ts             # Ukrainian
  ru.ts             # Russian
```

### Translation Source Strategy

1. **Initial batch**: AI-generated translations (via a one-shot script calling Claude/OpenAI with the full English map and a prompt to translate all 8 target languages)
2. **Storage**: Static TypeScript files committed to the repo
3. **Updates**: When new UI strings are added to `en.ts`, translators add one line per language
4. **No runtime AI needed**: Translations are bundle-static; no model downloads or API calls

### Hook Changes (`useLanguage.ts`)

```typescript
import { LANGUAGE_MAP } from "../lib/i18n";

export function useLanguage() {
  let language: AppLanguage = "en";
  try {
    const { settings } = useChat();
    language = settings.language || "en";
  } catch { /* noop */ }

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const strings = LANGUAGE_MAP[language] || LANGUAGE_MAP.en;
      let text = strings[key];
      if (!text) return LANGUAGE_MAP.en[key] || key; // fallback: English → raw key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.replace(`{${k}}`, String(v));
        }
      }
      return text;
    },
    [language],
  );

  return { language, t };
}
```

### Arabic/BiDi Considerations

- Arabic (`ar`) uses RTL layout. The `dir` attribute on `<html>` must switch to `rtl` when language is `ar`.
- This is **out of scope** for the initial pass — RTL layout requires extensive CSS rework. The Arabic translations will exist but the app will stay LTR with a note in Settings that RTL display is coming.

### Number of Strings

~75 keys as of this writing. Current inventory in `src/hooks/useLanguage.ts` lines 14-75.

---

## 3. Onboarding Wizard System

### 3.1 Trigger Mechanism

**Detection**: `localStorage` keys:
- `glv_onboarding_completed`: `true` after finishing all steps
- `glv_onboarding_step`: last completed step index (0-3) for resume
- `glv_onboarding_dismissed`: `true` if user dismissed the banner

**Decision logic** (client-side, runs in `layout.tsx` or a new `OnboardingProvider`):
1. If `glv_onboarding_completed` → show nothing
2. If `glv_onboarding_dismissed` → show nothing (never again)
3. Else → show persistent banner

### 3.2 Persistent Banner

**Position**: Full-width ribbon at top of page, above `<nav>` (inside the page content, before the navbar)

**Visual**:
```
┌──────────────────────────────────────────────────────────┐
│ 🏛  Set up your AI advisor and language in 2 minutes    │
│ [Start Setup] [Maybe Later]                              │
└──────────────────────────────────────────────────────────┘
```
- Background: `bg-accent-gold/5 border-b border-accent-gold/20`
- Text: `text-xs font-black uppercase tracking-widest text-accent-gold-body`
- Buttons: minimal, consistent with app style
- "Maybe Later" sets `glv_onboarding_dismissed` and hides

**Dismiss behavior**: Sets flag, never shows again. User can still access the wizard from Settings → "Onboarding" section → "View Setup Guide" button (also shows "Resume" if partially completed).

### 3.3 Full-Screen Wizard (Modal Overlay)

**Opening**: Clicking "Start Setup" on the banner, or from Settings page

**General behavior**:
- Dark backdrop (`bg-black/80 backdrop-blur-sm`)
- Centered card, max-width ~640px
- Animated enter/exit
- Can be closed via (X) button or Escape key at any step
- Closing saves current step to `glv_onboarding_step` for resume
- Does NOT auto-advance on time — requires explicit "Continue" clicks

### 3.4 Step 1: Language Selection

**Order**: This comes first so remaining steps render in the chosen language.

**Content**:
- Title: "Welcome to German Law Vault" (shown in English regardless — the one exception)
- Subtitle: "Select your preferred language for the interface"
- Language list: 9 pill buttons in a 3×3 grid, showing native names
  - Deutsch, English, Türkçe, العربية, Français, Español, Polski, Українська, Русский
- "Continue" button (disabled until a language is selected)

**On selection**:
- Immediately updates `settings.language` via `updateSettings()`
- Subsequent wizard steps and all `t()` calls use this language

### 3.5 Step 2: Mode Decision Tree

**Purpose**: Guide the user to the best AI mode for their setup.

**Flow** (rendered in the selected language):

```
Q1: "Do you have an API key for OpenAI or Anthropic?"
    [Yes] → Recommend Cloud AI
        - Show: Cloud card with icon, description
        - "You'll need to enter your API key in Settings"
        - Button: "Configure API Key" → links to Settings
        - Button: "Continue with Cloud"
    [No] → Q2

Q2: "Do you want AI to run entirely in your browser?"
    [Yes] → Recommend Browser AI
        - Show: Browser AI card
        - Note: "~1GB download on first use. Fully private."
        - Button: "Continue with Browser AI"
    [No] → Q3

Q3: "Do you have Ollama installed on your computer?"
    [Yes] → Recommend Local AI
        - Show: Local AI card
        - "Make sure the broker is running on port 9000"
        - Button: "Continue with Local AI"
    [No] → Recommend Basic Search
        - Show: Basic Search card
        - "No AI — search laws directly. You can set up AI later."
        - Button: "Continue in Basic Mode"
```

Each result card includes:
- Mode icon (FileText, Brain, Cloud, Plug)
- Mode name
- What this enables (chat, translation, guidance)
- What it requires (API key, model download, broker, nothing)
- A "Set up AI later" link (switches to Basic mode, continues wizard)

**On selection**: Calls `setMode(mode)` and advances to Step 3.

### 3.6 Step 3: Feature Overview

**Content** (rendered in chosen language):
- Title: "What you can do"
- 4-5 feature cards laid vertically, each with:
  - Icon
  - Feature name
  - Short description
  - Lock/unlock status based on chosen mode and auth state
- Features shown:
  1. **Search** — 6,000+ laws at your fingertips (always unlocked)
  2. **Chat** — AI legal advisor (unlocked if AI mode configured)
  3. **Guidance** — Outcome paths for your situation (requires AI + auth)
  4. **Translation** — Laws in your language (always available via browser worker)
  5. **Bookmarks** — Save laws (local always, cloud sync with auth)

**Interaction**: Scrollable, no action needed. "Continue" advances.

### 3.7 Step 4: Completion

**Content** (rendered in chosen language):
- Title: "You're all set"
- Summary of chosen mode and language
- "Start using the app" button
- Sets `glv_onboarding_completed: true`
- Clears `glv_onboarding_step`
- Closes wizard

### 3.8 Settings Integration

A new "Onboarding" section at the top of the Settings page:

```
┌─ Onboarding ───────────────────────────────────────────┐
│  You completed setup on [date]                         │
│  [View Setup Guide]  [Restart Onboarding]               │
└─────────────────────────────────────────────────────────┘
```

- If completed: shows completion date, "View Setup Guide" opens a non-interactive summary, "Restart Onboarding" clears all flags and re-shows banner
- If in progress: shows "Continue where you left off (Step N)"
- If never started: shows "Set up your AI advisor" button

### 3.9 File Changes

| File | Change |
|------|--------|
| `src/components/onboarding-banner.tsx` | **New** — persistent top ribbon |
| `src/components/onboarding-wizard.tsx` | **New** — full-screen wizard with all steps |
| `src/components/onboarding-context.tsx` | **New** — React context + localStorage helpers for onboarding state |
| `src/app/layout.tsx` | Add `OnboardingBanner` above navbar |
| `src/app/settings/page.tsx` | Add "Onboarding" section |
| `src/components/nav-bar.tsx` | Optional: dot badge if onboarding incomplete |
| `src/hooks/useLanguage.ts` | Rewrite to use `LANGUAGE_MAP` from i18n |
| `src/lib/i18n/*.ts` | **New** — 9 translation files + index |

---

## 4. Feature Gating

### 4.1 Problem

Features silently fail or show confusing error toasts when prerequisites aren't met. Example: a non-authed user clicking "Save" on a law sees a toast "Bookmark saved locally" — but the cloud sync icon suggests otherwise.

### 4.2 Solution: `<FeatureGate>` Wrapper

A composable component that wraps interactive elements:

```tsx
<FeatureGate
  requirement="auth"
  message="Sign in to sync bookmarks across devices"
>
  <button onClick={saveBookmark}>Save</button>
</FeatureGate>
```

**Behavior**:
- If requirement is met: renders children normally
- If not met: renders children with reduced opacity + a `Lock` icon overlay + a tooltip on hover with `message`
- Cursor becomes `not-allowed`
- Tooltip appears on hover with the message text
- Clicking the gate opens the auth page or shows a "Go to Settings" prompt depending on gate type

### 4.3 Gate Types

| Type | Check | Action on click |
|------|-------|----------------|
| `auth` | `user !== null` | Navigate to `/auth` |
| `api-key` | `hasStoredKey === true` | Navigate to `/settings` (API key section) |
| `ai-mode` | `mode !== "basic"` | Navigate to `/settings` |
| `ai-mode-local` | `brokerOk === true` | Show "Start broker" prompt |
| `browser-ai` | Browser model loaded | Navigate to `/settings` (model section) |
| `combined` | Multiple checks | Show first failing requirement |

### 4.4 Gated Elements Inventory

| Location | Element | Gate | Current Behavior | New Behavior |
|----------|---------|------|-----------------|--------------|
| Law page | Save button | `auth` | Saves local + toast "sync to cloud" | Lock icon if not authed, tooltip "Sign in to sync" |
| Law page | NormViewer translate | `ai-mode` | Shows fallback text | Lock icon if basic mode, tooltip with explainer |
| Navbar | Chat link | — | Works in basic mode (limited) | No gate (mode handled in-chat) |
| Chat page | Send button (cloud) | `api-key` | Shows error toast | Lock icon until API key configured |
| Chat page | Send button (local) | `ai-mode-local` | Shows error toast | Lock icon until broker running |
| Chat page | Send button (browser) | `browser-ai` | Shows download progress | Shows progress bar (no lock) |
| Guidance page | "Get Guidance" | `combined: auth + ai-mode` | Shows API error | Lock icon explaining both requirements |
| Bookmarks | Cloud sync indicators | `auth` | Works offline | Already handled by v2 dual-storage |
| Settings | Mode cards (non-applicable) | Varies | Shows limitations text | Lock icon + tooltip per card |
| Settings | API key section | `auth` | Shows only when logged in | No gate needed (already conditional) |

### 4.5 File Changes

| File | Change |
|------|--------|
| `src/components/feature-gate.tsx` | **New** — gate wrapper component |
| Components that wrap gated features | Add `<FeatureGate>` around affected buttons |

---

## 5. Section Translation UX

### 5.1 Problem

The `NormViewer` auto-fetches translation on expand. This wastes API calls/tokens when the user just wants to read the German text. The user wants control over when translation happens.

### 5.2 Solution: Manual Translate Trigger

Change the expanded state behavior from:

**Before**: Expand → auto `fetchExplanation()` → show translated text

**After**: Expand → show raw German content → user clicks "Translate to [language]" → `fetchExplanation()` → show translated text

### 5.3 Specific Changes

**`norm-viewer.tsx`**:
- Remove the `useEffect` that auto-calls `fetchExplanation()` on expand
- On expand, show content in German with a prominent button below: `"Translate to {LANGUAGE_NAMES[settings.language]}"` (e.g. "Translate to English")
- Button styling: `bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/20`
- While translating: show the existing per-mode explaining pill spinner
- After translation: show existing explanation grid (translation, summary, context, steps) below the German text
- Keep the "Show Original German" / "Show Translation" toggle for switching between the two

**Previous auto-translate behavior** for cloud mode that cached to `norm_explanations` table: This server-side caching is beneficial. The manual trigger should still cache — first click translates and caches, subsequent clicks show cached version instantly.

### 5.4 File Changes

| File | Change |
|------|--------|
| `src/components/norm-viewer.tsx` | Remove auto-fetch `useEffect`, add manual translate button, restructure render |

---

## 6. Non-Functional Requirements

- **All onboarding state** is client-only (localStorage). No server-side onboarding tracking.
- **Bundle size**: i18n files add ~15KB gzipped total for all 9 languages. Acceptable.
- **Performance**: Static imports mean zero runtime cost for translation lookups.
- **SSR**: Onboarding state reads localStorage only after mount (`useEffect` pattern), matches existing ChatProvider pattern. No hydration mismatch.
- **Accessibility**: Wizard is keyboard-navigable, uses `aria-modal`, focus trap, Escape to close.
- **8 pre-existing norm-viewer test failures**: Known and unrelated (from prior component rewrite). Not a blocker.

---

## 7. Out of Scope (Future)

- RTL layout for Arabic
- Server-side i18n for API error messages
- Animated onboarding tour (tooltip walkthroughs)
- A/B testing of wizard conversion
- Multi-step "create a case folder" onboarding flow
- Video tutorials or external help links
