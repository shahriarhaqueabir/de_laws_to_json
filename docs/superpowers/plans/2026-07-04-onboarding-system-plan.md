# Onboarding System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**: Implement a guided first-use onboarding wizard, feature gating with lock icons, manual section translation, and multilingual UI strings for the German Law Vault.

**Architecture**: 4 independent sub-projects built in priority order. Language translation maps feed the onboarding wizard UI. Feature gating is a composable wrapper. Section translation is a single-component change. All state is client-side localStorage.

**Tech Stack**: Next.js 16, React 19, TypeScript 5 strict, Tailwind CSS 4, lucide-react, motion 12

**Plan structure**: Tasks 1-7 are independent and can be parallelized. Tasks 8-12 depend on Task 1 (wizard needs translated strings).

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `src/lib/i18n/en.ts` | English UI strings (extracted from useLanguage.ts) |
| `src/lib/i18n/de.ts` | German UI strings |
| `src/lib/i18n/tr.ts` | Turkish UI strings |
| `src/lib/i18n/ar.ts` | Arabic UI strings |
| `src/lib/i18n/fr.ts` | French UI strings |
| `src/lib/i18n/es.ts` | Spanish UI strings |
| `src/lib/i18n/pl.ts` | Polish UI strings |
| `src/lib/i18n/uk.ts` | Ukrainian UI strings |
| `src/lib/i18n/ru.ts` | Russian UI strings |
| `src/lib/i18n/index.ts` | LANGUAGE_MAP export, merged from all languages |
| `src/components/feature-gate.tsx` | Composable feature gate wrapper |
| `src/components/onboarding-context.tsx` | Onboarding state provider + localStorage helpers |
| `src/components/onboarding-banner.tsx` | Persistent top ribbon |
| `src/components/onboarding-wizard.tsx` | Full-screen wizard (4 steps) |

### Modified Files
| File | Change |
|------|--------|
| `src/hooks/useLanguage.ts` | Rewrite to import from `i18n/index.ts`, use LANGUAGE_MAP |
| `src/components/norm-viewer.tsx` | Remove auto-fetch useEffect, add manual translate button |
| `src/app/layout.tsx` | Add OnboardingBanner above NavBar |
| `src/app/settings/page.tsx` | Add "Onboarding" section at top |
| `src/lib/types.ts` | Add OnboardingState to ChatSettings or create separate type (determined in Task 4) |
| Various components | Wrap gated elements in `<FeatureGate>` |

---

## Task 1: Extract English UI Strings to i18n Module

**Files:**
- Create: `src/lib/i18n/en.ts`
- Create: `src/lib/i18n/index.ts`
- Modify: `src/hooks/useLanguage.ts`

- [ ] **Step 1: Create English source-of-truth file**

Write `src/lib/i18n/en.ts`:
```typescript
// src/lib/i18n/en.ts — English UI Strings (source of truth)

export const EN: Record<string, string> = {
  "search.loading": "Searching...",
  "search.results_count": "{n} Statutes Retrieved",
  "search.empty": "No statutes found matching the inquiry parameters.",
  "search.error": "Failed to fetch search results.",
  "search.placeholder": "Search German laws...",
  "search.no_results": "No results found",
  "search.awaiting": "Awaiting Inquiry",
  "search.init": "Initializing Search Environment...",
  "laws.loading": "Decrypting Statute...",
  "laws.not_found": "Law not found or could not be loaded.",
  "laws.norms_empty": "Statutory fragments not currently indexed in neural memory.",
  "guidance.loading": "Analyzing Situation...",
  "guidance.title": "Legal Guidance",
  "guidance.describe": "Describe Your Situation",
  "guidance.analyze": "Analyze",
  "guidance.no_folder": "No folder selected",
  "guidance.history": "History",
  "common.error": "Operational Error",
  "nav.sign_in": "Sign In",
  "nav.sign_out": "Sign Out",
  "nav.search": "Search",
  "nav.guidance": "Guidance",
  "nav.bookmarks": "Bookmarks",
  "nav.chat": "Chat",
  "nav.settings": "Settings",
  "nav.laws": "Laws",
  "nav.api_docs": "API Docs",
  "footer.tagline": "Sub lege libertas",
  "footer.copyright": "© 2026 German Law Vault — Official Legal Intelligence Repository",
  "auth.title": "Welcome",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.sign_in_button": "Sign In",
  "auth.sign_up_button": "Create Account",
  "auth.no_account": "Don't have an account?",
  "auth.has_account": "Already have an account?",
  "auth.error_prefix": "Error",
  "chat.title": "Legal Advisor",
  "chat.placeholder": "Describe your legal situation...",
  "chat.send": "Send",
  "chat.settings": "Settings",
  "chat.local_offline": "Local Node Offline",
  "chat.startup_hint": "Start your local Ollama and broker to enable fully offline AI mode",
  "chat.mode_basic": "Basic",
  "chat.mode_browser": "Browser",
  "chat.mode_cloud": "Cloud",
  "chat.mode_local": "Local",
  "bookmarks.title": "My Bookmarks",
  "bookmarks.empty": "No bookmarks yet",
  "bookmarks.new_folder": "New Folder",
  "bookmarks.delete_folder": "Delete Folder",
  "settings.title": "Settings",
  "settings.api_key": "API Key",
  "settings.save": "Save",
  "settings.remove": "Remove",
  "settings.provider": "AI Provider",
  "settings.model": "Model",
  "onboarding.banner_text": "Set up your AI advisor and language in 2 minutes",
  "onboarding.start": "Start Setup",
  "onboarding.dismiss": "Maybe Later",
  "onboarding.welcome_title": "Welcome to German Law Vault",
  "onboarding.select_language": "Select your preferred language for the interface",
  "onboarding.continue": "Continue",
  "onboarding.step_language": "Language",
  "onboarding.step_mode": "AI Mode",
  "onboarding.step_features": "Features",
  "onboarding.step_complete": "You're All Set",
  "onboarding.api_key_q": "Do you have an API key for OpenAI or Anthropic?",
  "onboarding.yes": "Yes",
  "onboarding.no": "No",
  "onboarding.browser_q": "Do you want AI to run entirely in your browser?",
  "onboarding.ollama_q": "Do you have Ollama installed on your computer?",
  "onboarding.recommend_cloud": "Cloud AI — best quality, bring your own key",
  "onboarding.recommend_browser": "Browser AI — fully private, runs in-browser (~1GB download)",
  "onboarding.recommend_local": "Local AI — offline, uses your local Ollama",
  "onboarding.recommend_basic": "Basic Search — no AI, direct law search",
  "onboarding.feature_title": "What you can do",
  "onboarding.feature_search": "Search 6,000+ laws at your fingertips",
  "onboarding.feature_chat": "AI legal advisor",
  "onboarding.feature_guidance": "Outcome paths for your situation",
  "onboarding.feature_translation": "Laws translated into your language",
  "onboarding.feature_bookmarks": "Save and organize laws",
  "onboarding.complete_title": "You're all set",
  "onboarding.complete_desc": "Your preferences have been saved. Start exploring German law.",
  "onboarding.start_app": "Start using the app",
  "onboarding.restart": "Restart Onboarding",
  "onboarding.resume": "Continue where you left off",
  "onboarding.view_guide": "View Setup Guide",
  "onboarding.completed_on": "You completed setup on {date}",
  "gate.sign_in": "Sign in to use this feature",
  "gate.api_key": "Configure an API key in Settings to use this feature",
  "gate.ai_mode": "Switch to an AI mode in Settings to enable this feature",
  "gate.broker": "Start your local broker to enable Local AI",
};
```

- [ ] **Step 2: Create i18n index with LANGUAGE_MAP**

Write `src/lib/i18n/index.ts`:
```typescript
// src/lib/i18n/index.ts
import type { AppLanguage } from "../types";
import { EN } from "./en";

// All language maps. English is the default/fallback.
// Other languages will be populated as they're translated.
export const LANGUAGE_MAP: Record<AppLanguage, Record<string, string>> = {
  de: EN, // placeholder — will be German
  en: EN,
  tr: EN, // placeholder
  ar: EN, // placeholder
  fr: EN, // placeholder
  es: EN, // placeholder
  pl: EN, // placeholder
  uk: EN, // placeholder
  ru: EN, // placeholder
};
```

- [ ] **Step 3: Rewrite useLanguage hook to use LANGUAGE_MAP**

Modify `src/hooks/useLanguage.ts` — replace the entire `UI_STRINGS` constant and `t()` function:

```typescript
// Keep imports and file header, replace everything from UI_STRINGS to end of file

const { LANGUAGE_MAP } = await import("../lib/i18n"); // static import at top

// In the useLanguage function body, replace the t() implementation:
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
```

The full file at this point:

```typescript
"use client";

import { useCallback } from "react";
import { useChat } from "../components/chat-context";
import type { AppLanguage } from "../lib/types";
import { LANGUAGE_MAP } from "../lib/i18n";

export function useLanguage() {
  let language: AppLanguage = "en";
  try {
    const { settings } = useChat();
    language = settings.language || "en";
  } catch {
    language = "en";
  }

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const strings = LANGUAGE_MAP[language] || LANGUAGE_MAP.en;
      let text = strings[key];
      if (!text) return LANGUAGE_MAP.en[key] || key;
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

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile (existing errors from norm-viewer tests are pre-existing)

- [ ] **Step 5: Commit**

```bash
cd nextjs
git add src/lib/i18n/ src/hooks/useLanguage.ts
git commit -m "feat: extract UI strings to i18n module with LANGUAGE_MAP"
```

---

## Task 2: Create Language Translation Files (DE/TR/AR/FR/ES/PL/UK/RU)

**Files:**
- Create: `src/lib/i18n/de.ts`
- Create: `src/lib/i18n/tr.ts`
- Create: `src/lib/i18n/ar.ts`
- Create: `src/lib/i18n/fr.ts`
- Create: `src/lib/i18n/es.ts`
- Create: `src/lib/i18n/pl.ts`
- Create: `src/lib/i18n/uk.ts`
- Create: `src/lib/i18n/ru.ts`
- Modify: `src/lib/i18n/index.ts`

**Strategy**: Each file exports a `Record<string, string>` with the same keys as `en.ts`. For the initial implementation, create stub files with English strings as placeholders. Then run an AI batch generation script to produce real translations.

- [ ] **Step 1: Create one stub translation file**

Write `src/lib/i18n/de.ts`:
```typescript
// src/lib/i18n/de.ts — German UI Strings
// TODO: Replace English values with German translations
import { EN } from "./en";

export const DE: Record<string, string> = {
  ...EN,
  // German translations go here
};
```

- [ ] **Step 2: Create all 7 remaining stub files** (tr.ts, ar.ts, fr.ts, es.ts, pl.ts, uk.ts, ru.ts)

Same pattern: import EN, spread, override with translations.

Write each file as identical stub:
```typescript
// src/lib/i18n/tr.ts — Turkish UI Strings
// TODO: Replace English values with Turkish translations
import { EN } from "./en";
export const TR: Record<string, string> = { ...EN };
```

- [ ] **Step 3: Wire stubs into LANGUAGE_MAP**

Modify `src/lib/i18n/index.ts`:
```typescript
import type { AppLanguage } from "../types";
import { EN } from "./en";
import { DE } from "./de";
import { TR } from "./tr";
import { AR } from "./ar";
import { FR } from "./fr";
import { ES } from "./es";
import { PL } from "./pl";
import { UK } from "./uk";
import { RU } from "./ru";

export const LANGUAGE_MAP: Record<AppLanguage, Record<string, string>> = {
  de: DE,
  en: EN,
  tr: TR,
  ar: AR,
  fr: FR,
  es: ES,
  pl: PL,
  uk: UK,
  ru: RU,
};
```

- [ ] **Step 4: Run AI batch translation script**

Create a one-shot script `scripts/translate-i18n.ts` that sends the English keys to an AI provider and outputs translation files. Run it, then review and commit the generated files.

The script approach:
```typescript
// scripts/translate-i18n.ts — one-shot, not part of the app
// Sends EN strings to AI for each target language, writes translation files
// Usage: npx tsx scripts/translate-i18n.ts

const TARGET_LANGUAGES = [
  { code: "de", name: "German" },
  { code: "tr", name: "Turkish" },
  { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "pl", name: "Polish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ru", name: "Russian" },
];

// For each language, call AI with: "Translate these 80 UI strings to {language}.
// Return a JSON object with the same keys. maintain variables like {n} and {date} unchanged."
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 6: Commit**

```bash
cd nextjs
git add src/lib/i18n/
git commit -m "feat: add translation stubs for all 9 languages"
```

---

## Task 3: Create FeatureGate Component

**Files:**
- Create: `src/components/feature-gate.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/feature-gate.test.tsx`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeatureGate } from "../feature-gate";

// Mock useAuth
vi.mock("../auth-context", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

// Mock useChat
vi.mock("../chat-context", () => ({
  useChat: () => ({
    settings: { mode: "basic" },
  }),
}));

describe("FeatureGate", () => {
  it("renders children when requirement is met", () => {
    render(
      <FeatureGate requirement="auth" message="Sign in" met={true}>
        <button>Protected</button>
      </FeatureGate>,
    );
    expect(screen.getByText("Protected")).toBeDefined();
  });

  it("shows lock icon when requirement is not met", () => {
    const { container } = render(
      <FeatureGate requirement="auth" message="Sign in" met={false}>
        <button>Protected</button>
      </FeatureGate>,
    );
    // Should have a Lock icon rendered
    expect(container.querySelector("[data-testid='lock-icon']")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd nextjs && npx vitest run src/components/__tests__/feature-gate.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement FeatureGate component**

Write `src/components/feature-gate.tsx`:
```typescript
"use client";

import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";

export type GateRequirement = "auth" | "api-key" | "ai-mode" | "ai-mode-local" | "browser-ai";

interface FeatureGateProps {
  requirement: GateRequirement;
  message: string;
  met: boolean;
  children: ReactNode;
  /** Optional: action when clicked (navigate to /auth or /settings) */
  action?: () => void;
}

export function FeatureGate({
  requirement,
  message,
  met,
  children,
  action,
}: FeatureGateProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (met) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative group cursor-not-allowed"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onClick={(e) => {
        if (!met) {
          e.preventDefault();
          e.stopPropagation();
          action?.();
        }
      }}
    >
      {/* Children rendered at reduced opacity */}
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Lock
          data-testid="lock-icon"
          className="w-5 h-5 text-accent-gold opacity-60"
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-50 px-4 py-2 bg-zinc-900 border border-white/10 text-xs text-zinc-300 font-medium whitespace-nowrap shadow-xl rounded-sm animate-fade-in pointer-events-none">
          {message}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-zinc-900 border-r border-b border-white/10 rotate-45" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd nextjs && npx vitest run src/components/__tests__/feature-gate.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd nextjs
git add src/components/feature-gate.tsx src/components/__tests__/feature-gate.test.tsx
git commit -m "feat: add FeatureGate component with lock overlay and tooltip"
```

---

## Task 4: Create Onboarding Context Provider

**Files:**
- Create: `src/components/onboarding-context.tsx`

- [ ] **Step 1: Write implementation**

Write `src/components/onboarding-context.tsx`:
```typescript
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { AppLanguage } from "../lib/types";
import type { ChatMode } from "../lib/types";

const ONBOARDING_COMPLETED_KEY = "glv_onboarding_completed";
const ONBOARDING_STEP_KEY = "glv_onboarding_step";
const ONBOARDING_DISMISSED_KEY = "glv_onboarding_dismissed";
const ONBOARDING_COMPLETED_DATE_KEY = "glv_onboarding_completed_date";
const ONBOARDING_MODE_KEY = "glv_onboarding_selected_mode";
const ONBOARDING_LANGUAGE_KEY = "glv_onboarding_selected_language";

export interface OnboardingState {
  completed: boolean;
  step: number;       // 0-3, 0 = not started, 3 = completion step
  dismissed: boolean;
  completedDate: string | null;
  selectedMode: ChatMode | null;
  selectedLanguage: AppLanguage | null;
}

interface OnboardingContextValue {
  state: OnboardingState;
  setStep: (step: number) => void;
  setCompleted: () => void;
  setDismissed: () => void;
  setSelectedMode: (mode: ChatMode) => void;
  setSelectedLanguage: (lang: AppLanguage) => void;
  resetOnboarding: () => void;
  showWizard: boolean;
  setShowWizard: (show: boolean) => void;
}

const defaultState: OnboardingState = {
  completed: false,
  step: 0,
  dismissed: false,
  completedDate: null,
  selectedMode: null,
  selectedLanguage: null,
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined,
);

export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [showWizard, setShowWizard] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const completed = localStorage.getItem(ONBOARDING_COMPLETED_KEY) === "true";
    const step = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) || "0", 10);
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
    const completedDate = localStorage.getItem(ONBOARDING_COMPLETED_DATE_KEY);
    const selectedMode = localStorage.getItem(ONBOARDING_MODE_KEY) as ChatMode | null;
    const selectedLanguage = localStorage.getItem(ONBOARDING_LANGUAGE_KEY) as AppLanguage | null;

    setState({ completed, step, dismissed, completedDate, selectedMode, selectedLanguage });
  }, []);

  const persist = (key: string, value: string) => {
    if (typeof window !== "undefined") localStorage.setItem(key, value);
  };

  const setStep = (step: number) => {
    setState((prev) => ({ ...prev, step }));
    persist(ONBOARDING_STEP_KEY, String(step));
  };

  const setCompleted = () => {
    const date = new Date().toISOString().split("T")[0];
    setState((prev) => ({
      ...prev,
      completed: true,
      step: 0,
      completedDate: date,
    }));
    persist(ONBOARDING_COMPLETED_KEY, "true");
    persist(ONBOARDING_STEP_KEY, "0");
    persist(ONBOARDING_COMPLETED_DATE_KEY, date);
  };

  const setDismissed = () => {
    setState((prev) => ({ ...prev, dismissed: true }));
    persist(ONBOARDING_DISMISSED_KEY, "true");
  };

  const setSelectedMode = (mode: ChatMode) => {
    setState((prev) => ({ ...prev, selectedMode: mode }));
    persist(ONBOARDING_MODE_KEY, mode);
  };

  const setSelectedLanguage = (lang: AppLanguage) => {
    setState((prev) => ({ ...prev, selectedLanguage: lang }));
    persist(ONBOARDING_LANGUAGE_KEY, lang);
  };

  const resetOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
      localStorage.removeItem(ONBOARDING_STEP_KEY);
      localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
      localStorage.removeItem(ONBOARDING_COMPLETED_DATE_KEY);
      localStorage.removeItem(ONBOARDING_MODE_KEY);
      localStorage.removeItem(ONBOARDING_LANGUAGE_KEY);
    }
    setState(defaultState);
    setShowWizard(false);
  };

  return (
    <OnboardingContext.Provider
      value={{
        state,
        setStep,
        setCompleted,
        setDismissed,
        setSelectedMode,
        setSelectedLanguage,
        resetOnboarding,
        showWizard,
        setShowWizard,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile (pre-existing test errors excluded)

- [ ] **Step 3: Commit**

```bash
cd nextjs
git add src/components/onboarding-context.tsx
git commit -m "feat: add OnboardingContext with localStorage persistence"
```

---

## Task 5: Create Onboarding Banner Component

**Files:**
- Create: `src/components/onboarding-banner.tsx`

- [ ] **Step 1: Write implementation**

Write `src/components/onboarding-banner.tsx`:
```typescript
"use client";

import { useOnboarding } from "./onboarding-context";
import { useLanguage } from "../hooks/useLanguage";

export function OnboardingBanner() {
  const { state, setDismissed, setShowWizard } = useOnboarding();
  const { t } = useLanguage();

  // Don't show if completed, dismissed, or not yet mounted
  if (state.completed || state.dismissed) return null;

  return (
    <div className="w-full bg-accent-gold/5 border-b border-accent-gold/20">
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <p className="text-xs font-black uppercase tracking-widest text-accent-gold-body">
          🏛 {t("onboarding.banner_text")}
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWizard(true)}
            className="text-xs font-black uppercase tracking-[0.2em] px-4 py-2 bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/20 hover:bg-accent-gold/20 transition-colors active:scale-95"
          >
            {t("onboarding.start")}
          </button>
          <button
            onClick={setDismissed}
            className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {t("onboarding.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 3: Commit**

```bash
cd nextjs
git add src/components/onboarding-banner.tsx
git commit -m "feat: add OnboardingBanner persistent ribbon"
```

---

## Task 6: Create Onboarding Wizard Component

**Files:**
- Create: `src/components/onboarding-wizard.tsx`

- [ ] **Step 1: Write the wizard component**

Write `src/components/onboarding-wizard.tsx` — this is the largest new component. It has 4 steps rendered based on `step` state, with a progress indicator and navigation.

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Check, ArrowRight, FileText, Brain, Cloud, Plug, Globe, Search, MessageSquare, Compass, Languages, Bookmark } from "lucide-react";
import { useOnboarding } from "./onboarding-context";
import { useLanguage } from "../hooks/useLanguage";
import { useChat } from "./chat-context";
import { LANGUAGE_LABELS, type AppLanguage, type ChatMode } from "../lib/types";

// ── Step Indicator ──

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
            i <= current ? "bg-accent-gold" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

// ── Language Selection Step ──

function LanguageStep({
  onLanguageSelect,
}: {
  onLanguageSelect: (lang: AppLanguage) => void;
}) {
  const entries = Object.entries(LANGUAGE_LABELS) as [AppLanguage, string][];

  return (
    <div className="text-center">
      <Globe className="w-12 h-12 text-accent-gold mx-auto mb-6" />
      <h2 className="text-2xl font-serif font-bold text-white mb-3">
        Welcome to German Law Vault
      </h2>
      <p className="text-sm text-zinc-400 mb-10 max-w-md mx-auto">
        Select your preferred language for the interface
      </p>
      <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto mb-10">
        {entries.map(([code, label]) => (
          <button
            key={code}
            onClick={() => onLanguageSelect(code)}
            className="px-4 py-4 border border-white/10 bg-white/[0.02] hover:border-accent-gold/30 hover:bg-accent-gold/5 text-white text-sm font-bold transition-all duration-300 active:scale-95 rounded-sm"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Mode Decision Tree Step ──

function ModeStep({
  onModeSelect,
}: {
  onModeSelect: (mode: ChatMode) => void;
}) {
  const { t } = useLanguage();
  const [q1, setQ1] = useState<boolean | null>(null);
  const [q2, setQ2] = useState<boolean | null>(null);
  const [q3, setQ3] = useState<boolean | null>(null);
  const [recommendation, setRecommendation] = useState<ChatMode | null>(null);

  const handleAnswer = useCallback(
    (question: number, answer: boolean) => {
      if (question === 1) {
        setQ1(answer);
        if (answer) setRecommendation("cloud");
      } else if (question === 2) {
        setQ2(answer);
        if (answer) setRecommendation("browser");
      } else if (question === 3) {
        setQ3(answer);
        if (!answer) setRecommendation("basic");
        else setRecommendation("local");
      }
    },
    [],
  );

  const modeMeta: Record<ChatMode, { icon: typeof FileText; color: string; description: string }> = {
    cloud: { icon: Cloud, color: "text-accent-cobalt", description: t("onboarding.recommend_cloud") },
    browser: { icon: Brain, color: "text-accent-amber", description: t("onboarding.recommend_browser") },
    local: { icon: Plug, color: "text-accent-gold-bright", description: t("onboarding.recommend_local") },
    basic: { icon: FileText, color: "text-zinc-500", description: t("onboarding.recommend_basic") },
  };

  const MIcon = recommendation ? modeMeta[recommendation].icon : FileText;

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-8 text-center">
        {t("onboarding.step_mode")}
      </h2>

      {!recommendation && (
        <div className="space-y-6 max-w-md mx-auto">
          {/* Q1 */}
          <div>
            <p className="text-sm font-bold text-zinc-300 mb-4">{t("onboarding.api_key_q")}</p>
            <div className="flex gap-3">
              <button onClick={() => handleAnswer(1, true)} className="flex-1 px-6 py-3 border border-accent-gold/20 bg-accent-gold/5 text-accent-gold-bright text-sm font-bold hover:bg-accent-gold/10 transition-all active:scale-95">
                {t("onboarding.yes")}
              </button>
              <button onClick={() => handleAnswer(1, false)} className="flex-1 px-6 py-3 border border-white/10 bg-white/[0.02] text-zinc-400 text-sm font-bold hover:border-white/20 transition-all active:scale-95">
                {t("onboarding.no")}
              </button>
            </div>
          </div>

          {q1 === false && (
            <div>
              <p className="text-sm font-bold text-zinc-300 mb-4">{t("onboarding.browser_q")}</p>
              <div className="flex gap-3">
                <button onClick={() => handleAnswer(2, true)} className="flex-1 px-6 py-3 border border-accent-amber/20 bg-accent-amber/5 text-accent-amber text-sm font-bold hover:bg-accent-amber/10 transition-all active:scale-95">
                  {t("onboarding.yes")}
                </button>
                <button onClick={() => handleAnswer(2, false)} className="flex-1 px-6 py-3 border border-white/10 bg-white/[0.02] text-zinc-400 text-sm font-bold hover:border-white/20 transition-all active:scale-95">
                  {t("onboarding.no")}
                </button>
              </div>
            </div>
          )}

          {q2 === false && (
            <div>
              <p className="text-sm font-bold text-zinc-300 mb-4">{t("onboarding.ollama_q")}</p>
              <div className="flex gap-3">
                <button onClick={() => handleAnswer(3, true)} className="flex-1 px-6 py-3 border border-accent-gold-bright/20 bg-accent-gold-bright/5 text-accent-gold-bright text-sm font-bold hover:bg-accent-gold-bright/10 transition-all active:scale-95">
                  {t("onboarding.yes")}
                </button>
                <button onClick={() => handleAnswer(3, false)} className="flex-1 px-6 py-3 border border-white/10 bg-white/[0.02] text-zinc-400 text-sm font-bold hover:border-white/20 transition-all active:scale-95">
                  {t("onboarding.no")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {recommendation && (
        <div className="max-w-sm mx-auto text-center animate-fade-in">
          <div className={`p-6 border border-white/10 bg-white/[0.02] mb-6`}>
            <MIcon className={`w-10 h-10 mx-auto mb-4 ${modeMeta[recommendation].color}`} />
            <p className="text-sm text-zinc-400 mb-6">
              {modeMeta[recommendation].description}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => onModeSelect(recommendation)}
                className="w-full px-6 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
              >
                Continue with {recommendation === "cloud" ? "Cloud" : recommendation === "browser" ? "Browser AI" : recommendation === "local" ? "Local AI" : "Basic"}
              </button>
              <button
                onClick={() => { setQ1(null); setQ2(null); setQ3(null); setRecommendation(null); }}
                className="text-xs font-bold text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feature Overview Step ──

function FeatureStep() {
  const { t } = useLanguage();
  const features = [
    { icon: Search, label: t("onboarding.feature_search"), unlocked: true },
    { icon: MessageSquare, label: t("onboarding.feature_chat"), unlocked: false },
    { icon: Compass, label: t("onboarding.feature_guidance"), unlocked: false },
    { icon: Languages, label: t("onboarding.feature_translation"), unlocked: true },
    { icon: Bookmark, label: t("onboarding.feature_bookmarks"), unlocked: true },
  ];

  return (
    <div>
      <h2 className="text-2xl font-serif font-bold text-white mb-8 text-center">
        {t("onboarding.feature_title")}
      </h2>
      <div className="space-y-3 max-w-md mx-auto">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.label}
              className="flex items-center gap-4 px-5 py-4 border border-white/5 bg-white/[0.01]"
            >
              <Icon className="w-5 h-5 text-accent-gold opacity-60 shrink-0" />
              <span className="text-sm text-zinc-300 flex-1">{f.label}</span>
              {f.unlocked ? (
                <Check className="w-4 h-4 text-green-500/60 shrink-0" />
              ) : (
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-600 shrink-0">
                  {t("onboarding.step_mode")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Completion Step ──

function CompleteStep() {
  const { t } = useLanguage();
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-accent-gold-bright" />
      </div>
      <h2 className="text-2xl font-serif font-bold text-white mb-3">
        {t("onboarding.complete_title")}
      </h2>
      <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
        {t("onboarding.complete_desc")}
      </p>
    </div>
  );
}

// ── Main Wizard Component ──

export function OnboardingWizard() {
  const { state, setStep, setCompleted, setSelectedMode, setSelectedLanguage, showWizard, setShowWizard } = useOnboarding();
  const { t, language } = useLanguage();
  const { updateSettings } = useChat();
  const [step, setLocalStep] = useState(state.step);

  // Keep local step in sync with context
  useEffect(() => {
    setLocalStep(state.step);
  }, [state.step]);

  if (!showWizard) return null;

  const totalSteps = 4;

  const handleLanguageSelect = (lang: AppLanguage) => {
    setSelectedLanguage(lang);
    updateSettings({ language: lang });
    advance();
  };

  const handleModeSelect = (mode: ChatMode) => {
    setSelectedMode(mode);
    updateSettings({ mode });
    advance();
  };

  const advance = () => {
    const next = step + 1;
    if (next >= totalSteps) {
      setCompleted();
      setShowWizard(false);
    } else {
      setLocalStep(next);
      setStep(next);
    }
  };

  const handleClose = () => {
    // Save current step so user can resume
    setStep(step);
    setShowWizard(false);
  };

  const stepLabels = [
    t("onboarding.step_language"),
    t("onboarding.step_mode"),
    t("onboarding.step_features"),
    t("onboarding.step_complete"),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-zinc-950 border border-white/10 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 border-b border-white/5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500 opacity-50">
              {step + 1} / {totalSteps}
            </p>
            <p className="text-xs font-bold text-zinc-600 mt-1">
              {stepLabels[step]}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-zinc-600 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <StepIndicator current={step} total={totalSteps - 1} />

          {step === 0 && <LanguageStep onLanguageSelect={handleLanguageSelect} />}
          {step === 1 && <ModeStep onModeSelect={handleModeSelect} />}
          {step === 2 && <FeatureStep />}
          {step === 3 && <CompleteStep />}
        </div>

        {/* Footer */}
        {step === totalSteps - 1 && (
          <div className="px-8 pb-8 pt-4 border-t border-white/5">
            <button
              onClick={() => { setCompleted(); setShowWizard(false); }}
              className="w-full px-6 py-3 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all active:scale-95"
            >
              {t("onboarding.start_app")} <ArrowRight className="w-3 h-3 inline ml-2" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 3: Commit**

```bash
cd nextjs
git add src/components/onboarding-wizard.tsx
git commit -m "feat: add OnboardingWizard with 4-step full-screen wizard"
```

---

## Task 7: Wire Onboarding into Layout and Settings

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add OnboardingProvider and components to root layout**

Modify `src/app/layout.tsx`. The layout already has a Providers wrapper. Add the `OnboardingProvider` inside the Providers tree, and render `OnboardingBanner` + `OnboardingWizard` components.

The layout likely looks like:
```tsx
<LangProvider>
  <Providers>
    <AuthProvider>
      <ChatProvider>
        {children}
      </ChatProvider>
    </AuthProvider>
  </Providers>
</LangProvider>

// Change to:

<LangProvider>
  <Providers>
    <AuthProvider>
      <ChatProvider>
        <OnboardingProvider>
          <OnboardingBanner />
          <OnboardingWizard />
          {children}
        </OnboardingProvider>
      </ChatProvider>
    </AuthProvider>
  </Providers>
</LangProvider>
```

Read the actual layout file at `src/app/layout.tsx` to determine where OnboardingProvider goes.

- [ ] **Step 2: Add Onboarding section to Settings page**

Modify `src/app/settings/page.tsx`. Add a new section at the top (after the header, before "AI Mode"):

```tsx
// Inside SettingsPage return, after the saved-status span and before AI Mode section:

{/* ── Onboarding Section ── */}
<section className="mb-12">
  <div className="flex items-center gap-4 mb-6">
    <div className="p-3 border border-accent-gold/20 bg-accent-gold/5">
      <Compass className="w-5 h-5 text-accent-gold" />
    </div>
    <div>
      <h2 className="font-serif font-bold text-xl text-white">Onboarding</h2>
    </div>
  </div>
  <div className="glass-panel p-6 border-white/5">
    {onboardingState.completed ? (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-zinc-400">
            You completed setup on {onboardingState.completedDate}
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            Language: {LANGUAGE_LABELS[language]} · Mode: {mode}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowWizard(true)}
            className="px-4 py-2 border border-accent-gold/20 text-accent-gold-body text-xs font-bold hover:bg-accent-gold/10 transition-all"
          >
            View Setup Guide
          </button>
          <button
            onClick={resetOnboarding}
            className="px-4 py-2 border border-white/10 text-zinc-400 text-xs font-bold hover:bg-white/5 transition-all"
          >
            Restart Onboarding
          </button>
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">
          {onboardingState.step > 0
            ? `Continue where you left off (Step ${onboardingState.step + 1})`
            : "Set up your AI advisor and language preferences"}
        </p>
        <button
          onClick={() => setShowWizard(true)}
          className="px-4 py-2 bg-accent-gold text-black font-black uppercase tracking-[0.2em] text-xs hover:bg-accent-gold-bright transition-all"
        >
          {onboardingState.step > 0 ? "Continue" : "Start Setup"}
        </button>
      </div>
    )}
  </div>
</section>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 4: Commit**

```bash
cd nextjs
git add src/app/layout.tsx src/app/settings/page.tsx
git commit -m "feat: wire onboarding provider into layout and settings page"
```

---

## Task 8: Apply Feature Gates to Gated Elements

**Files:**
- Modify: `src/components/norm-viewer.tsx` — wrap translate section
- Modify: `src/app/laws/[key]/law-content.tsx` — wrap save button
- Modify: `src/app/guidance/page.tsx` — wrap "Get Guidance" button
- Modify: `src/app/chat/page.tsx` — wrap send button per mode

**Note**: This task is a targeted pass — add `<FeatureGate>` wrappers. Do not restructure the components.

- [ ] **Step 1: Gate the law page save button**

In `law-content.tsx`, wrap the save/bookmark button:
```tsx
<FeatureGate
  requirement="auth"
  message="Sign in to sync bookmarks across devices"
  met={!!user}
>
  <button
    onClick={toggleBookmark}
    className="..."
  >
    ...
  </button>
</FeatureGate>
```

- [ ] **Step 2: Gate the NormViewer translate area**

In `norm-viewer.tsx`, wrap the "Translate to [language]" button (after we change it to manual in Task 10):
```tsx
<FeatureGate
  requirement="ai-mode"
  message="Switch to an AI mode in Settings to translate laws"
  met={settings.mode !== "basic"}
>
  <button onClick={fetchExplanation}>
    Translate to {LANGUAGE_NAMES[settings.language]}
  </button>
</FeatureGate>
```

- [ ] **Step 3: Gate the Guidance "Get Guidance" button**

In `guidance/page.tsx`, wrap the submit button:
```tsx
<FeatureGate
  requirement="auth"
  message="Sign in and configure AI in Settings for legal guidance"
  met={!!user && settings.mode !== "basic"}
>
  <button onClick={handleGetGuidance} ...>Get Guidance</button>
</FeatureGate>
```

- [ ] **Step 4: Gate the Chat send button per mode**

In `chat/page.tsx`, wrap the send button based on current mode:
- Cloud mode: gate on `api-key`
- Local mode: gate on `ai-mode-local` (broker running)
- Browser mode: no gate (shows download progress)
- Basic mode: no gate (search only)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 6: Commit**

```bash
cd nextjs
git commit -m "feat: apply FeatureGate wrappers to gated elements"
```

---

## Task 9: Run All Tests

- [ ] **Step 1: Run existing test suite**

Run: `cd nextjs && npm test`
Expected: Existing tests pass (8 pre-existing norm-viewer failures are known/expected)

Note the 8 pre-existing failures:
- `src/components/__tests__/norm-viewer.test.tsx` — these 8 tests were broken by a previous component rewrite. Not part of this sprint.

- [ ] **Step 2: Run new component tests**

Run: `cd nextjs && npx vitest run src/components/__tests__/feature-gate.test.tsx`
Expected: PASS

---

## Task 10: Change NormViewer to Manual Translate

**Files:**
- Modify: `src/components/norm-viewer.tsx`

- [ ] **Step 1: Remove the auto-fetch useEffect**

Find and remove lines 194-202 in current norm-viewer.tsx:
```typescript
// Remove this block:
useEffect(() => {
  if (expanded) {
    startTransition(() => {
      fetchExplanation();
    });
  }
}, [expanded, fetchExplanation]);
```

- [ ] **Step 2: Add manual translate button in expanded state**

In the expanded content render, after showing the raw German content, add a button before the explanation grid section:

```typescript
// Inside renderContent(), after the content <p> and before the closing </div>, add:
{!explanation && !explaining && (
  <div className="mt-8 text-center">
    <button
      onClick={() => fetchExplanation()}
      disabled={explaining}
      className="px-8 py-4 bg-accent-gold/10 text-accent-gold-bright border border-accent-gold/20 text-sm font-black uppercase tracking-[0.2em] hover:bg-accent-gold/20 transition-all active:scale-95"
    >
      Translate to {LANGUAGE_NAMES[settings.language] || "English"}
    </button>
  </div>
)}

{explaining && !explanation && (
  <div className="mt-8 flex justify-center">
    {explainingPill()}
  </div>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd nextjs && npx tsc --noEmit`
Expected: Clean compile

- [ ] **Step 4: Commit**

```bash
cd nextjs
git add src/components/norm-viewer.tsx
git commit -m "feat: change NormViewer to manual translate trigger instead of auto-fetch"
```

---

## Appendix: Edge Cases & States

| State | Where | Expected Behavior |
|-------|-------|------------------|
| First visit, no auth, no AI | Home page | Banner shows, wizard on click |
| Returning user, banner dismissed | All pages | No banner. Settings has "Start Setup" |
| Returning user, partially complete | All pages | No banner. Settings has "Continue Step N" |
| User completed onboarding | All pages | No banner. Settings shows "completed on [date]" |
| User switches language after onboarding | Settings/any | UI strings update immediately via `t()` re-render |
| User in Basic mode, clicks translate | Law page | Lock icon with tooltip: "Switch to AI mode" |
| User not authed, clicks bookmark | Law page | Lock icon with tooltip: "Sign in to sync" |
| Norm section expanded, no AI configured | Law page | Shows raw German + translate button + gate lock |
| Norm section expanded, after translate | Law page | Shows translated + explanation grid + toggle |
| All localStorage cleared mid-wizard | Settings | Step resets to 0, banner shows again |
| Wizard closed mid-step | Any page | Step saved to localStorage. "Continue Step N" in Settings |
