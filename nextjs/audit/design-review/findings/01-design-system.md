# Design System & Visual Consistency Audit

## Summary

The project has a well-conceived visual direction (dark cinematic + muted gold) expressed through CSS custom properties in `globals.css`, but the design token system is incomplete and inconsistently applied across components. Two widely-used accent colors (`accent-cobalt`, `accent-amber`) are entirely missing from the Tailwind `@theme` and `:root`, rendering all their utility classes non-functional. The `globals.css` has duplicate rule blocks that produce conflicting typography values. Several components bypass the design token system entirely with hardcoded hex colors, and no consistent spacing or type scale exists.

---

## Findings

### F-001: Duplicate `h1/h2/h3` and `.legal-text` rule blocks
- **Severity**: high
- **File**: `globals.css` (lines 121–137 and 147–159)
- **Current**: Two identical selector groups appear:

  ```css
  /* Block 1 (L121-130) */
  h1, h2, h3 {
    font-family: var(--font-serif);
    font-weight: 700;              /* only in block 1 */
    letter-spacing: -0.03em;       /* overridden by block 2 */
    color: var(--text-primary);    /* only in block 1 */
    text-wrap: balance;            /* only in block 1 */
  }
  .legal-text {
    line-height: 1.8;              /* overridden by block 2 */
    font-size: 1.05rem;
    letter-spacing: 0.01em;
    color: var(--text-secondary);  /* only in block 1 */
  }

  /* Block 2 (L147-159) */
  h1, h2, h3 {
    font-family: var(--font-serif);
    letter-spacing: -0.02em;       /* wins */
    /* font-weight, color, text-wrap NOT set — inherit from block 1 */
  }
  .legal-text {
    line-height: 1.7;              /* wins */
    font-size: 1.05rem;
    letter-spacing: 0.01em;
    /* color NOT set — inherits from block 1 */
  }
  ```

- **Issue**: Both blocks target the same selectors. Block 2 partially overrides Block 1, creating a confusing cascade where `font-weight: 700` works only because Block 2 doesn't redeclare it, while `letter-spacing` silently flips from `-0.03em` to `-0.02em` and `line-height` flips from `1.8` to `1.7`. A maintainer deleting either block by accident would change visual output.
- **Recommendation**: Merge into a single block with explicit values for every property. Remove the redundant comment header at L147.
- **Category**: consistency

### F-002: Missing `accent-cobalt` and `accent-amber` theme tokens — all usages are broken
- **Severity**: critical
- **File**: `globals.css` (lines 31–38, `@theme inline` block)
- **Current**: The `@theme inline` block registers only 4 color tokens: `background`, `foreground`, `accent-gold`, `accent-gold-bright`. There are no `--color-accent-cobalt` or `--color-accent-amber` entries. However, these classes are used extensively:

  | Token | Files using it | Type |
  |-------|---------------|------|
  | `text-accent-cobalt` | `guidance/page.tsx`, `cost-risk-calculator.tsx`, `folder-modal.tsx`, `remediation-roadmap.tsx` | text color |
  | `bg-accent-cobalt/10`, `bg-accent-cobalt/20`, `bg-accent-cobalt/5` | `guidance/page.tsx`, `cost-risk-calculator.tsx`, `folder-modal.tsx`, `remediation-roadmap.tsx` | background |
  | `border-accent-cobalt/20`, `border-accent-cobalt/30`, `focus:border-accent-cobalt/50` | `folder-modal.tsx`, `guidance/page.tsx`, `remediation-roadmap.tsx` | border |
  | `hover:bg-accent-cobalt/90`, `hover:bg-accent-cobalt/30` | `guidance/page.tsx`, `folder-modal.tsx` | hover state |
  | `accent-accent-cobalt` | `cost-risk-calculator.tsx` (L38) | form accent |
  | `text-accent-amber`, `border-l-accent-amber`, `bg-accent-amber/10` | `remediation-roadmap.tsx` (L93, L117), `guidance/page.tsx` (L192) | amber |

- **Issue**: Tailwind v4 generates utility classes only for tokens in `@theme`/`@theme inline`. Since `accent-cobalt` and `accent-amber` are absent, all ~30+ usages of `text-accent-cobalt`, `bg-accent-cobalt/10`, `border-accent-cobalt/20`, `accent-accent-cobalt` etc. produce no CSS. The affected elements silently inherit their parent's color — they appear as default muted zinc instead of the intended cobalt/amber. This is a runtime bug affecting the guidance flow, folder management, cost calculator, and remediation roadmap.
- **Recommendation**: Add both tokens to `@theme inline`:
  ```css
  --color-accent-cobalt: #2e5bff;
  --color-accent-amber: #f59e0b;
  ```
  (Verify exact hex values match intent.)
- **Category**: consistency

### F-003: `animate-fade-in` used but never defined
- **Severity**: high
- **File**: `globals.css` (missing keyframe definition)
- **Current**: The class `animate-fade-in` is applied to elements in `nav-bar.tsx` (L176, L245), `law-card.tsx` (L116), `norm-viewer.tsx` (L193, L278), and `search-bar.tsx` (L70). No `@keyframes fade-in` or `animate-fade-in` utility exists in `globals.css` or any loaded CSS.
- **Issue**: The animation does nothing. Dropdowns, expanded sections, and sign-in prompts appear without the intended entrance fade. Tailwind v4 only generates `animate-*` utilities from `@theme` `--animate-*` entries or explicit CSS. This is silently missing.
- **Recommendation**: Add to globals.css:
  ```css
  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  ```
  Or register via `@theme`:
  ```css
  @theme inline {
    --animate-fade-in: fade-in 0.3s ease-out;
  }
  ```
- **Category**: consistency

### F-004: Root layout hardcodes background/text colors instead of using theme tokens
- **Severity**: medium
- **File**: `layout.tsx` (line 22)
- **Current**: `<body className="min-h-full flex flex-col bg-[#0d0d0d] text-[#a3a3a3]">` uses arbitrary Tailwind values `bg-[#0d0d0d]` and `text-[#a3a3a3]`.
- **Issue**: The `@theme inline` block at L31-33 defines `--color-background` and `--color-foreground` tokens, yet the root layout doesn't use them. `#0d0d0d` maps to `--bg-secondary: #0a0a0a` (close but not exact), and `#a3a3a3` is unrelated to any CSS variable. This creates a disconnect between what the theme system advertises and what the app actually renders.
- **Recommendation**: Use `bg-background text-foreground` to align with the theme. If the intent is `--bg-secondary` and `--text-secondary`, surface those into `@theme inline` and use them.
- **Category**: consistency

### F-005: Auth page uses entirely hardcoded colors, no theme tokens
- **Severity**: medium
- **File**: `auth/page.tsx` (lines 47–112)
- **Current**: Every color on the auth page is hardcoded as arbitrary Tailwind values:
  - `bg-[#0d0d0d]`, `bg-[#1a1a1a]`, `bg-[#141414]`, `bg-[#888888]`
  - `text-[#e8e8e8]`, `text-[#a3a3a3]`, `text-[#888888]`
  - `border-[#2a2a2a]`, `border-[#888888]`
  - `focus:ring-[#888888]`, `hover:bg-[#aaaaaa]`
- **Issue**: The auth page is a separate visual universe that doesn't reference `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, or `--accent-gold`. `#888888` (grey) is used as the accent/C-color instead of `--accent-gold`/`--accent-gold-bright`. This means changing the theme palette requires manually updating every hex in this file.
- **Recommendation**: Replace hardcoded hexes with CSS variable references. Use `bg-[var(--bg-secondary)]` or add corresponding `@theme` tokens. Use `accent-gold`/`accent-gold-bright` for interactive elements instead of `#888888`/`#aaaaaa`.
- **Category**: consistency

### F-006: OAuth consent page copies same broken pattern as auth page
- **Severity**: medium
- **File**: `oauth/consent/page.tsx` (lines 41–363)
- **Current**: Entire page uses hardcoded `bg-[#0d0d0d]`, `bg-[#141414]`, `bg-[#1a1a1a]`, `text-[#e8e8e8]`, `text-[#a3a3a3]`, `text-[#888]`, `border-[#2a2a2a]`, `hover:bg-[#1a1a1a]`, etc.
- **Issue**: Same as F-005 — duplicates the auth page's hardcoded color scheme, disconnected from the design token system.
- **Recommendation**: Same as F-005. Extract shared auth-page styling into a utility or use theme variables.
- **Category**: consistency

### F-007: `@theme inline` is incomplete — many CSS variables lack Tailwind utility counterparts
- **Severity**: medium
- **File**: `globals.css` (lines 31–38)
- **Current**: The `@theme inline` block registers only 6 entries. The following `:root` variables have NO corresponding Tailwind utilities:
  - `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-elevated`, `--bg-glass`, `--bg-glass-heavy`
  - `--text-primary`, `--text-secondary`, `--text-muted`
  - `--border-glass`, `--border-metal`, `--border-gold`
  - `--shadow-premium`, `--shadow-gold`
  - `--accent-gold-glow`
- **Issue**: Components must choose between `var(--bg-glass)` (correct, but inconsistent with Tailwind patterns) and being unable to use utility classes like `bg-glass` or `border-glass`. This is why some components use `glass-panel` (via CSS class) while others use `bg-white/5` or `bg-black/40` — there's no utility for the actual glass tokens.
- **Recommendation**: Extend `@theme inline` to expose the most-used `:root` variables as Tailwind utilities, e.g.:
  ```css
  --color-surface-primary: var(--bg-primary);
  --color-surface-secondary: var(--bg-secondary);
  --color-surface-tertiary: var(--bg-tertiary);
  --color-surface-elevated: var(--bg-elevated);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  ```
  Or migrate to use utility classes exclusively and phase out the `premium-card`/`glass-panel` approach.
- **Category**: consistency

### F-008: Hardcoded zinc colors in components bypass theme variables
- **Severity**: medium
- **File**: Multiple components — `nav-bar.tsx`, `guidance-paths-display.tsx`, `cost-risk-calculator.tsx`, `conversation-list.tsx`, etc.
- **Current**: Components repeatedly use Tailwind's built-in zinc palette (`text-zinc-500`, `text-zinc-600`, `text-zinc-700`, `text-zinc-400`, `text-zinc-300`, `bg-zinc-900/20`, `bg-zinc-950/40`) instead of theme text variables. For example:
  - `nav-bar.tsx` L112: `text-zinc-500 hover:text-white` — should be `text-secondary hover:text-primary`
  - `cost-risk-calculator.tsx` L27: `text-[#6b6b6b]` — hardcoded hex
  - `guidance-paths-display.tsx` L166: `text-zinc-600`
  - `norm-viewer.tsx` L170: `text-zinc-400`
- **Issue**: The `:root` defines `--text-secondary: #a1a1aa` and `--text-muted: #52525b` but these are never used via Tailwind utilities. Instead, arbitrary zinc shades are chosen per component. If the theme shifts (e.g., cooler greys to warmer greys), each component must be updated individually.
- **Recommendation**: Add `--color-text-secondary` and `--color-text-muted` to `@theme inline` and replace `text-zinc-*` usages with `text-text-secondary` or `text-text-muted` where appropriate. Use `text-zinc-*` only for non-text decorative elements.
- **Category**: consistency

### F-009: `var(--accent-primary)` references nonexistent variable
- **Severity**: medium
- **File**: `globals.css` (line 200)
- **Current**: `:focus-visible { outline: 1px solid var(--accent-primary); }`
- **Issue**: There is no `--accent-primary` in `:root`. The project uses `--accent-gold` and `--accent-gold-bright`. The focus outline resolves to `transparent`, making it invisible. This is an accessibility issue as keyboard users won't see focus indicators.
- **Recommendation**: Change to `var(--accent-gold)` or `var(--accent-gold-bright)`.
- **Category**: consistency

### F-010: Scrollbar hover and selection colors use blue tone outside the theme palette
- **Severity**: low
- **File**: `globals.css` (lines 174, 179)
- **Current**:
  - `::-webkit-scrollbar-thumb:hover { background: rgba(46, 91, 255, 0.2); }` (blue)
  - `::selection { background: rgba(46, 91, 255, 0.25); color: white; }` (blue)
- **Issue**: The `accent-cobalt` is missing from `:root` (see F-002), but even if it were defined, the use of raw `rgba(46, 91, 255, ...)` hardcodes a blue accent that competes with the gold-accent design language. No other element in the app uses this blue. The selection color should use the gold palette.
- **Recommendation**: Replace with gold-toned values, e.g.:
  ```css
  ::-webkit-scrollbar-thumb:hover { background: rgba(138, 123, 99, 0.3); }
  ::selection { background: rgba(138, 123, 99, 0.25); color: white; }
  ```
- **Category**: consistency

### F-011: `font-serif` maps to the same sans font as `font-sans`
- **Severity**: low
- **File**: `globals.css` (line 37)
- **Current**: `--font-serif: var(--font-geist-sans), serif;`
- **Issue**: Both `--font-sans` and `--font-serif` resolve to the same Geist Sans typeface. The serif fallback (`serif`) only activates if Geist Sans fails to load. Headings tagged with `font-serif` are rendered in the same geometric sans-serif as body text — there's no actual serif/script contrast. This undermines the "cinematic legal" aesthetic.
- **Recommendation**: Either add a genuine serif font (e.g., `var(--font-geist-mono)` as a placeholder, or a proper serif like Playfair Display / EB Garamond loaded via next/font), or rename the utility to avoid implying serif styling.
- **Category**: consistency

### F-012: No consistent spacing or type scale
- **Severity**: low
- **File**: All components
- **Current**: Components use arbitrary padding and font-size values without a system:
  - Card padding: `p-10` (law-card), `p-8` (norm-viewer, cost-risk-calculator), `p-12` (guidance loading state), `p-6` (folder-modal forms), `p-5` (remediation-roadmap timeline nodes)
  - Button sizes: `px-3 py-1.5` to `px-8 py-4` across 6+ variants
  - Font sizes for UI labels: `text-[8px]`, `text-[9px]`, `text-[10px]`, `text-[11px]`, `text-[13px]` — arbitrary instead of a scale
  - `monumental-type` class uses `font-size: 0.7rem` (`~11.2px`) while other tags use `text-[9px]` or `text-[10px]` for similar "small uppercase label" purposes
- **Issue**: Without a defined spacing/type scale designers and maintainers must guess values for every new element. The `text-[Npx]` pattern proliferates (20+ occurrences across components) indicating the base Tailwind type scale is being bypassed rather than extended at the theme level.
- **Recommendation**: Define a small custom type scale in `@theme`:
  ```css
  --font-size-label-micro: 0.5rem;   /* 8px */
  --font-size-label-xs: 0.5625rem;   /* 9px */
  --font-size-label-sm: 0.625rem;    /* 10px */
  --font-size-label-base: 0.6875rem; /* 11px */
  ```
  And a spacing rhythm:
  ```css
  --spacing-card: 2.5rem;   /* 40px = p-10 */
  --spacing-section: 1.5rem; /* 24px */
  ```
  Then refactor `text-[Npx]` occurrences to use the semantic labels.
- **Category**: consistency

### F-013: `accent-silver` defined in `:root` but never used
- **Severity**: suggestion
- **File**: `globals.css` (line 22)
- **Current**: `--accent-silver: #d4d4d8;`
- **Issue**: This variable is defined in the design token system but referenced zero times across all CSS and components.
- **Recommendation**: Either remove if unused, or expose via `@theme inline` and use it for secondary iconography or subtle highlights instead of `text-zinc-400`/`text-zinc-500`.
- **Category**: consistency

### F-014: `cost-risk-calculator.tsx` uses hardcoded hex colors throughout
- **Severity**: medium
- **File**: `cost-risk-calculator.tsx` (lines 27, 44, 53, 59, 65, 71, 83, 91)
- **Current**: Uses `text-[#6b6b6b]`, `text-[#444444]`, `bg-[#0d0d0d]/50`, `text-[#a3a3a3]` directly.
- **Issue**: These hardcoded values have no relationship to the theme variables. `#6b6b6b` is close to `--text-muted: #52525b` but not identical. `#444444` is unique. Changing the theme requires finding every hex in this file.
- **Recommendation**: Replace with `text-text-muted` (via `var(--text-muted)`) or the appropriate Tailwind zinc-* scale entry, and `bg-[var(--bg-secondary)]` for the fine-print box.
- **Category**: consistency

### F-015: Mixed approach — CSS classes vs Tailwind utilities for same visual role
- **Severity**: low
- **File**: Multiple components + `globals.css`
- **Current**: Some visual treatments are defined as CSS classes in globals.css (`.glass-panel`, `.glass-panel-heavy`, `.premium-card`, `.gold-link`, `.monumental-type`, `.legal-text`) while equivalent patterns are done with Tailwind utilities inline. For example:
  - A panel is `glass-panel` in some places, but `bg-white/5 border border-white/5` in others (category-grid, cost-risk-calculator result cards)
  - The `monumental-type` class provides `text-transform: uppercase, letter-spacing: 0.3em, font-size: 0.7rem, font-weight: 800, color: var(--accent-gold)` but many elements recreate similar styles with `text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500`
- **Issue**: A developer must know both systems to determine intent. `.monumental-type` is semantically clear but composable inline classes are more flexible. The two approaches drift over time.
- **Recommendation**: Audit usage of each custom CSS class. Either double-down on the CSS class approach (preferred for complex multi-property patterns) and create CSS classes for any repeated combination, or convert the custom classes to `@utility` directives in Tailwind v4 format for better composability.
- **Category**: consistency

### F-016: `shadow-glow` used but never defined
- **Severity**: medium
- **File**: `remediation-roadmap.tsx` (line 115)
- **Current**: `<div className="... shadow-glow">`
- **Issue**: `shadow-glow` is not defined in `globals.css` or any `@theme` entry. This Tailwind utility class generates no CSS, so the "Outcome Simulator Insight" card has no shadow effect.
- **Recommendation**: Either add a utility class for `.shadow-glow` in globals.css or register it via `@theme`:
  ```css
  @theme inline {
    --shadow-glow: 0 0 30px rgba(46, 91, 255, 0.15);
  }
  ```
  Adjust the color to match whichever accent is intended.
- **Category**: consistency

### F-017: Nav-bar uses `bg-white/5` for mode badges instead of theme glass tokens
- **Severity**: low
- **File**: `nav-bar.tsx` (lines 36–57, `MODE_META` colors)
- **Current**: All four chat mode entries use `bg: "bg-white/5"` and `color: "text-zinc-500"`.
- **Issue**: These hardcoded inline values duplicate what `glass-panel-heavy` or `var(--bg-glass)` already define. The `bg-white/5` tint is not an actual background token — it's an arbitrary opacity variant that would need to be changed everywhere if the glass aesthetic evolves.
- **Recommendation**: Replace with `bg-glass` (if added as a utility per F-007) or reference an equivalent theme var.
- **Category**: consistency
