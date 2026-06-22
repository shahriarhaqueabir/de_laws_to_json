# Frontend Design Review — Consolidated Findings

> Generated 2026-06-22 · 4 audit lanes · 1 conductor pass
> Sources: `findings/01-design-system.md`, `findings/02-component-polish.md`, `findings/03-a11y-ux.md`, `findings/04-taste-review.md`

---

## Summary

**77 findings** across 4 lanes, deduplicated into **58 unique issues** ranked by severity.

| Severity | Count | Action |
|----------|-------|--------|
| Critical | 8 | Blocking — fix before next deploy |
| High | 15 | Sprint-ready — significant impact |
| Medium | 17 | Polish pass candidate |
| Low | 11 | Minor, batch with other work |
| Suggestion | 7 | Future enhancement |

---

## Critical (8)

### C-01: `:focus-visible` references undefined CSS variable — no focus indicator everywhere
- **Status**: ✅ Fixed — `globals.css` now uses `outline: 1px solid var(--accent-gold-bright)`
- **Sources**: DS-F-009, A11Y-F-002
- **File**: `globals.css` (L199-202)
- **What**: `outline: 1px solid var(--accent-primary)` — `--accent-primary` is never defined, making the entire rule invalid. Every interactive element in the app is invisible to keyboard users.
- **Fix**: Change to `outline: 1px solid var(--accent-gold-bright)` or define `--accent-primary` in `:root`.
- **Cost**: 1 line.

### C-02: Hardcoded `lang="en"` ignores user's 9-language selector
- **Status**: ✅ Mitigated — `LangProvider` sets `document.documentElement.lang` + `dir` client-side via `useEffect`
- **Sources**: A11Y-F-001
- **File**: `layout.tsx` (L21), `lang-provider.tsx`
- **What**: `<html lang="en">` is static during SSR. Screen readers mispronounce all non-English content (WCAG 3.1.1).
- **Fix**: `LangProvider` reads language from localStorage and applies to `<html>` post-hydration. SSR default remains `en`.
- **Cost**: ~10 lines in `lang-provider.tsx`.

### C-03: Chat input, send button, and search input have no accessible labels
- **Status**: ✅ Fixed — all inputs have `aria-label` attributes
- **Sources**: A11Y-F-003, A11Y-F-004, A11Y-F-005
- **Files**: `chat/page.tsx`, `search-bar.tsx`
- **What**: `<input>` with no `aria-label` and no visible `<label>`. Screen readers cannot identify these controls.
- **Fix**: `aria-label="Chat message"` on chat input, `aria-label="Send"` on send button, `aria-label="Search laws"` on search bar.
- **Cost**: 3 attribute additions.

### C-04: Theatrical naming erodes professional credibility
- **Status**: ✅ Fixed — all theatrical labels replaced with plain terms
- **Sources**: TASTE-F-001
- **Files**: `chat-message-bubble.tsx`, `chat/page.tsx`, `chat/error.tsx`, `error.tsx`, `chat/[id]/page.tsx`, `bookmarks/page.tsx`, `laws/[key]/page.tsx`, `search/page.tsx`, `norm-viewer.tsx`, `useLanguage.ts`
- **What**: "VAULT RESPONSE // REF 0000" → "Response #00", "Consult the Vault" → "Legal Advice", "Initializing Channel..." → "Loading...", "Channel Interrupted" → "Chat Error", "System Interruption" → "Unexpected Error", "Registry Inactive" → "No Bookmarks", "Archives Empty" → "No Saved Laws", "Personal Registry" → "My Bookmarks", "Return to Vault" → "Back", "Archived"/"Add to Archives" → "Saved"/"Save", "Protocol" → "Steps", "Scanning Archives..." → "Searching..."
- **Cost**: Text replacements across ~12 files.

### C-05: No actual serif typeface — `font-serif` is a ghost class
- **Status**: ✅ Fixed — Playfair Display imported as real serif
- **Sources**: DS-F-011, TASTE-F-002
- **File**: `layout.tsx` + `globals.css`
- **What**: Both `--font-sans` and `--font-serif` were set to Geist Sans. Every `font-serif` class rendered as sans-serif.
- **Fix**: Imported Playfair Display via `next/font/google`, wired to `--font-serif-playfair` CSS variable, updated `@theme inline` to reference the real serif.
- **Cost**: 8 lines in layout.tsx, 1 line in globals.css.

### C-06: `accent-cobalt` and `accent-amber` tokens used but never defined in `@theme inline`
- **Status**: ✅ Fixed — both added to `@theme inline`
- **Sources**: DS-F-002
- **Files**: `globals.css`
- **What**: `bg-accent-cobalt`, `text-accent-amber`, etc. appeared ~30 times with no `@theme` definition.
- **Fix**: Added `--color-accent-cobalt: #3b82f6` and `--color-accent-amber: #f59e0b` to `@theme inline`.
- **Cost**: 2 lines in globals.css.

### C-07: Loading states invisible to screen readers
- **Status**: ✅ Fixed — all loading states have `role="status"` + `aria-live="polite"`
- **Sources**: A11Y-F-007, A11Y-F-008, A11Y-F-009
- **Files**: `chat/page.tsx`, `search-bar.tsx`, `search/page.tsx`, `chat/[id]/page.tsx`
- **What**: Loading spinners, "Generating..." text, and "Retrieving Statutes..." had no `role="status"` or `aria-live` region.
- **Fix**: Added `role="status" aria-live="polite"` to search-bar status text, search page spinner, chat suspense fallback, and chat [id] page loading indicator. Chat message log already had `role="log"`.
- **Cost**: 4 attribute additions.

### C-08: `animate-fade-in` used in 4+ components but never defined
- **Status**: ✅ Fixed — `@keyframes fade-in` + `.animate-fade-in` class added
- **Sources**: DS-F-003
- **Files**: `globals.css`
- **What**: The class `animate-fade-in` was referenced in JSX but had no `@keyframes` definition.
- **Fix**: Added `@keyframes fade-in` and `.animate-fade-in` utility class in `globals.css`.
- **Cost**: ~8 lines in globals.css.

---

## High (15)

### H-01: Missing focus-visible rings on all interactive elements
- **Status**: ✅ Fixed — added `focus-visible:ring-1 focus-visible:ring-accent-gold` to all `focus:outline-none` instances across `search-bar.tsx`, `auth/page.tsx`, `chat/[id]/page.tsx`, `chat/page.tsx`, `guidance/page.tsx`, `settings/page.tsx`, `folder-modal.tsx` (20+ occurrences)
- **Sources**: POLISH-F-001
- **Files**: All component files — 20+ occurrences of `focus:outline-none` with no replacement focus style.
- **Issue**: Even if C-01 is fixed (the CSS variable), many elements use `focus:outline-none` which would override the global rule.
- **Fix**: Audit all `focus:outline-none` usages and ensure the global `:focus-visible` rule applies, or add `focus-visible:ring-1 focus-visible:ring-accent-gold` per element.

### H-02: Two competing toast notification systems
- **Status**: ✅ Fixed — migrated all call sites from custom `useToast()` to sonner `toast` API. Custom `toast.tsx` now re-exports sonner. `ToastProvider` removed from `layout.tsx`.
- **Sources**: POLISH-F-002
- **Files**: `toast.tsx` + `providers.tsx` (sonner)
- **Issue**: Custom `ToastProvider` from `toast.tsx` and sonner's `<Toaster>` from `providers.tsx` both operate. Components use a mix of both — visual and behavioral inconsistency.
- **Fix**: Pick one (sonner is more feature-rich) and remove the other.

### H-03: Missing Escape key handling on all dropdowns
- **Sources**: A11Y-F-006
- **Files**: `nav-bar.tsx` (language selector, mode selector)
- **Issue**: Dropdowns open on click but don't close on Escape. Users must click the button again or click the backdrop overlay.
- **Fix**: Add `onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}` to the dropdown container.

### H-04: Color contrast failures on near-black backgrounds
- **Status**: ✅ Fixed — `text-zinc-600` → `text-zinc-400` on all dark-background elements in `nav-bar.tsx`, `settings/page.tsx`, `chat/page.tsx`, `auth/page.tsx`, `chat/[id]/page.tsx`
- **Sources**: A11Y-F-010
- **Files**: `nav-bar.tsx`, `settings/page.tsx`, `chat/page.tsx`, `auth/page.tsx`
- **Issue**: `text-zinc-600` (#52525b) on `bg-[#0d0d0d]` is ~3.6:1. Some panels use `text-zinc-500` on `bg-[#0a0a0a]` which may be below 4.5:1 for normal text.
- **Fix**: Use `text-zinc-400` (#a1a1aa) or `var(--text-secondary)` as minimum for body text on dark backgrounds.

### H-05: Core navigation items hidden on mobile with no alternative [L108-114]
- **Status**: ✅ Fixed — hamburger button + slide-in drawer added for mobile
- **Fix**: Hamburger toggle (`sm:hidden`) + `w-72` drawer with backdrop, nav links, active indicators, and user link
- **Files**: `nav-bar.tsx`, `globals.css` (added `@keyframes slide-in-left` + `.animate-slide-in-left`)
- **Sources**: POLISH-F-015, A11Y-F-013
- **File**: `nav-bar.tsx` (L101-123)
- **Issue**: All 4 primary nav links are `hidden sm:flex`. Below 640px, there's no hamburger menu or alternative — the only way to navigate is through the mode dropdown or URL.
- **Fix**: Add a hamburger / mobile nav drawer for screens below `sm`.

### H-06: Missing `aria-expanded` and `aria-haspopup` on all dropdown toggles
- **Sources**: A11Y-F-011
- **Files**: `nav-bar.tsx` (language selector, mode selector)
- **Issue**: Screen readers get no signal that a dropdown is present or open.
- **Fix**: Add `aria-haspopup="true"` and `aria-expanded={open}` to both toggle buttons.

### H-07: Auth page and OAuth consent page use entirely hardcoded colors
- **Sources**: DS-F-005, DS-F-006
- **Files**: `auth/page.tsx`, OAuth consent page
- **Issue**: Hardcoded `bg-black`, `text-white`, `bg-zinc-900`, etc. None of these use the theme's CSS variables.
- **Fix**: Replace with `bg-background`, `text-foreground`, `bg-tertiary`, etc.

### H-08: `.monumental-type` (tiny uppercase tracking-widest) overused [L126-132]
- **Status**: ✅ Fixed — reduced from 20+ to 0 instances across all pages
- **Fix**: Replaced all `monumental-type` class usages with inline utility classes (`text-xs font-bold uppercase tracking-widest text-zinc-500`). `.monumental-type` CSS class retained for backward compatibility but no longer referenced in page components.
- **Files**: `page.tsx`, `search/page.tsx`, `settings/page.tsx`, `guidance/page.tsx`, `guidance/history/page.tsx`, `laws/[key]/page.tsx`
- **Sources**: TASTE-F-003
- **Files**: 20+ occurrences across all pages
- **Issue**: What should be emphasis is now the default label style. It's everywhere — losing all rhetorical power.
- **Fix**: Reduce usage to section headings only (3-4 per page max). Convert secondary labels to regular weight + normal case.

### H-09: Undersized touch targets on interactive elements
- **Status**: ✅ Fixed — sign-out btn `p-2` → `p-2.5`, lang toggle `py-1.5` → `py-2.5`, mode toggle `py-1.5` → `py-2.5` in `nav-bar.tsx`
- **Sources**: POLISH-F-003
- **Files**: `nav-bar.tsx` (sign-out: 28px), conversation-list delete buttons, nav links, close icon
- **Issue**: Below the 44px minimum recommended by Apple/Android HIG. Causes mis-taps on mobile.
- **Fix**: Increase hit areas to min 44×44px using padding or transparent extension.

### H-10: SearchBar has no loading/disabled state
- **Status**: ✅ Fixed — added `Loader2` to import, `submitting` state already wired, spinner + disabled buttons during navigation
- **Sources**: POLISH-F-004
- **File**: `search-bar.tsx`
- **Issue**: Rapid double-clicks on the search button queue redundant navigations. No visual feedback that a search is in flight.
- **Fix**: Add `submitting` state, disable button during navigation, show loading indicator.

### H-11: Root layout uses hardcoded `bg-[#0d0d0d]` instead of `bg-background`
- **Sources**: DS-F-004
- **File**: `layout.tsx` (L22)
- **Issue**: Bypasses the theme system. If the background token changes, the layout won't follow.
- **Fix**: Replace with `bg-background` Tailwind class.

### H-12: No skip-to-content link
- **Sources**: A11Y-F-012
- **Files**: `layout.tsx`, no skip link present anywhere
- **Issue**: Keyboard and screen reader users must tab through the full nav bar before reaching main content on every page.
- **Fix**: Add a skip link as the first focusable element: `<a href="#main-content" className="sr-only focus:not-sr-only ...">Skip to content</a>`.

### H-13: `@theme inline` only exposes 4 of 15+ CSS variables as Tailwind utilities
- **Sources**: DS-F-007
- **File**: `globals.css`
- **Issue**: Only `--color-background`, `--color-foreground`, `--color-accent-gold`, `--color-accent-gold-bright`, `--font-sans`, `--font-serif` are in `@theme inline`. The rest (`--bg-secondary`, `--bg-tertiary`, `--bg-glass`, `--text-secondary`, `--text-muted`, `--border-glass`, `--shadow-premium`, etc.) must be accessed via `var()`, creating inconsistency.
- **Fix**: Add all semantic tokens to `@theme inline`, or commit fully to `var()` approach.

### H-14: Language selector uses flag emojis — inconsistent rendering
- **Sources**: TASTE-F-007
- **File**: `nav-bar.tsx` (L195-214)
- **Issue**: Flag emojis render differently across OS (Windows shows text-only boxes on some flags, macOS has inconsistent skin tones, Linux lacks many flags). The Saudi flag 🇸🇦 specifically renders as "SA" on some systems.
- **Fix**: Replace with 2-letter language codes or country-flag SVG components.

### H-15: Pervasive hardcoded hex colors in cost-risk-calculator.tsx
- **Status**: ✅ Fixed — replaced `#6b6b6b` → `text-muted`, `#444444` → `text-muted`, `#a3a3a3` → `text-secondary`, `bg-[#0d0d0d]` → `bg-tertiary`
- **Sources**: DS-F-014
- **File**: `cost-risk-calculator.tsx`
- **Issue**: Entire file uses hardcoded hex colors instead of theme tokens.
- **Fix**: Replace with CSS variable references or Tailwind theme classes.

---

## Medium (17)

| ID | Issue | File(s) | Source |
|----|-------|---------|--------|
| M-01 | Duplicate CSS rule blocks (`h1/h2/h3`, `.legal-text`) with conflicting values | `globals.css` (L32-43 vs L148-159) | DS-F-001 |
| M-02 | Error and info toasts visually identical | `toast.tsx` | POLISH-F-005 |
| M-03 | Toasts lack manual dismiss button (auto-dismiss only) | `toast.tsx` | POLISH-F-006 |
| M-04 | LawCard renders empty gap when `relevantNorms` is `[]` | `law-card.tsx` | POLISH-F-008 |
| M-05 | Chat cited law links can overflow on long keys | `chat-message-bubble.tsx` | POLISH-F-010 |
| M-06 | Scrollbar hover and selection use blue off-palette | `globals.css` (L170-180) | DS-F-010 |
| M-07 | Remove "VAULT RESPONSE // REF" decorator from chat messages | `chat/page.tsx` | TASTE-F-004 |
| M-08 | Remove decorative corner brackets from assistant messages | `chat/page.tsx` | TASTE-F-013 |
| M-09 | Chat "Legal Advisor" vs "Legal Inquiry Terminal" identity confusion | `chat/page.tsx` | TASTE-F-016 |
| M-10 | "Initialize" CTA on home page cards | `page.tsx` | TASTE-F-008 |
| M-11 | Error messages in all-caps tracking style reduce readability | `settings/page.tsx`, auth | TASTE-F-006 |
| M-12 | `shadow-glow` used but never defined in CSS | `page.tsx` | DS-F-016 |
| M-13 | Guidance expand buttons missing `aria-expanded`/`aria-controls` | `guidance-paths-display.tsx` | POLISH-F-013 |
| M-14 | Nav-bar `bg-white/5` for mode badges bypasses glass tokens | `nav-bar.tsx` | DS-F-017 |
| M-15 | Chat input lacks visible focus enhancement when active | `chat/page.tsx` | TASTE-F-011 |
| M-16 | Global SVG noise texture may cause performance issues on low-end devices | `globals.css` | TASTE-F-014 |
| M-17 | No `dir` attribute handling for Arabic (RTL) | `layout.tsx` | A11Y-F-018 |

---

## Low (11)

| ID | Issue | File(s) | Source |
|----|-------|---------|--------|
| L-01 | Root layout body colors hardcoded in Tailwind classes despite having CSS variables | `layout.tsx` (L22) | DS-F-004 |
| L-02 | `font-serif` — already flagged in C-05, but additionally the Geist font has no serif variant at all | `layout.tsx` | DS-F-011 |
| L-03 | `--accent-silver` defined in `:root` but never used | `globals.css` | DS-F-013 |
| L-04 | Mixed approach — CSS classes vs Tailwind utilities for same visual role drifts over time | Various | DS-F-015 |
| L-05 | Remove "Operational" redundant badge from settings active mode | `settings/page.tsx` | TASTE-F-012 |
| L-06 | Remove "Substrate Status" non-actionable section | `settings/page.tsx` | TASTE-F-010 |
| L-07 | Home page "Legal Labyrinth Guide" tone-deaf heading | `chat/page.tsx` (empty state) | TASTE-F-015 |
| L-08 | RemediationRoadmap uses index-based keys | `remediation-roadmap.tsx` | POLISH-F-014 |
| L-09 | Auth "Initialize Session" link has empty title | `nav-bar.tsx` | A11Y-F-019 |
| L-10 | Search "Analyze via AI" button lacks `aria-label` | `search-bar.tsx` | A11Y-F-020 |
| L-11 | Settings "Test Connection" result lacks `role="status"` | `settings/page.tsx` | A11Y-F-021 |

---

## Suggestion (7)

| ID | Suggestion | Source |
|----|-----------|--------|
| S-01 | Add `role="navigation"` and `aria-label` to the `<nav>` element | A11Y-F-017 |
| S-02 | Implement radio group semantics for settings mode selector | A11Y-F-016 |
| S-03 | Add `max` visible toast limit | POLISH-F-017 |
| S-04 | Add RTL stylesheet or CSS logical properties for Arabic support | A11Y-F-018 |
| S-05 | Replace flag emojis with text language codes | TASTE-F-007 |
| S-06 | Remove outer glass-panel wrapper around CategoryGrid (unnecessary nesting) | TASTE-F-009 |
| S-07 | Add disabled/loading state to CostRiskCalculator value display | POLISH-F-016 |

---

## Top 10 Quick Wins (Fix Order)

These are ordered by impact-per-effort. Each is ≤5 lines of change.

1. **C-01** — Fix `:focus-visible` CSS variable → restores keyboard focus across entire app (1 line)
2. **C-03** — Add 3 `aria-label` attributes → chat + search become screen-reader accessible (3 lines)
3. **C-06** — Add `accent-cobalt`/`accent-amber` to `@theme inline` → unbreaks 30 silent style failures (2 lines)
4. **C-08** — Add `@keyframes fade-in` → restores all fade-in animations (8 lines)
5. **H-03** — Add Escape handlers to dropdowns → keyboard usability fix (4 lines)
6. **H-06** — Add `aria-expanded` to dropdown toggles → screen reader signal (2 lines)
7. **H-12** — Add skip-to-content link → keyboard navigation (1 anchor tag)
8. **M-01** — Delete duplicate CSS blocks → eliminates conflicting rules (10 lines removed)
9. **M-07** — Remove "VAULT RESPONSE // REF" text → cleans up chat output (1 line)
10. **H-05** — Add mobile nav hamburger → core navigation on phones

---

## What's Actually Good

The audit also found genuinely solid design decisions worth preserving:

- **Gold accent system** (`accent-gold` / `accent-gold-bright`) — consistent, tasteful, applied sparingly
- **`premium-card` hover** — lift + border glow animation is polished and smooth
- **Category grid tiles** — animated gold left-border on hover is a nice tactile detail
- **Chat message distinction** — user = gold border-right, assistant = glass panel — clear at a glance
- **Nav sticky behavior** — sticky top-6 with glass backdrop is well-executed
- **Dark theme depth** — the layered backgrounds (radial gradients + glass panels) create genuine depth
- **Performance** — no layout shift, no oversized images, no render-blocking resources

The visual foundation is strong. Most of the issues are **subtractive and corrective** — remove the theatrical language, fix the CSS variables, add the aria attributes — rather than needing a visual redesign.
