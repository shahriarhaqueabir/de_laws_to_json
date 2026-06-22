# UI Component Polish Audit

## Summary

Audited 10 core UI components across the German Law Vault frontend for interaction states, loading/empty/error states, responsive behavior, touch targets, text overflow, and visual consistency. The codebase has a strong dark-themed design system with consistent `glass-panel`, `premium-card`, and `monumental-type` utilities. Overall polish is good, but several gaps were identified:

- **Focus-visible rings are missing on virtually every interactive element**, which hurts keyboard accessibility.
- **Inconsistent toast systems**: the app has its own `ToastProvider` in `toast.tsx` OR `sonner`'s `<Toaster>` in `providers.tsx`, and components use a mix of both.
- **Several interactive elements have undersized touch targets** (<44px) that fail touch usability criteria.
- **No loading/disabled states** on the search bar and cost calculator.
- **Error and info toasts are visually identical** in the custom toast system.

**Severity distribution**: 2 high, 8 medium, 5 low, 3 suggestion.

---

## Findings

### F-001: Missing focus-visible rings on all interactive elements
- **Severity**: high
- **Files**: All 10 components
- **Current**: Nearly every `<button>`, `<Link>`, `<a>`, and `<input>` uses `focus:outline-none` without providing a `focus-visible:ring` or `focus-visible:outline` replacement. Examples:
  - `nav-bar.tsx` L110 — nav links, no `focus-visible`
  - `nav-bar.tsx` L148 — sign out button, no `focus-visible`
  - `nav-bar.tsx` L160 — language button, no `focus-visible`
  - `search-bar.tsx` L51 — search button, no `focus-visible`
  - `search-bar.tsx` L60 — AI analyze button, no `focus-visible`
  - `category-grid.tsx` L100 — category links, no `focus-visible`
  - `law-card.tsx` L46 — bookmark button, no `focus-visible`
  - `chat-message-bubble.tsx` L52 — cited law links, no `focus-visible`
  - `conversation-list.tsx` L115 — close button, no `focus-visible`
  - `guidance-paths-display.tsx` L200 — path expand buttons, no `focus-visible`
  - `guidance-paths-display.tsx` L425 — generate doc button, no `focus-visible`
  - `cost-risk-calculator.tsx` L32 — range slider, no `focus-visible`
  - `remediation-roadmap.tsx` L104 — "Start this step" button, no `focus-visible`
- **Issue**: Keyboard users cannot see which element is focused. The app uses `focus:outline-none` extensively (confirmed via grep — 20+ occurrences in `.tsx` files) but never pairs it with `focus-visible:ring-*`. This fails WCAG 2.4.7.
- **Recommendation**: Add `focus-visible:ring-2 focus-visible:ring-accent-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]` to all interactive elements that currently suppress the default outline. Or add a global rule in `globals.css`:

  ```css
  *:focus-visible {
    outline: 2px solid var(--accent-gold);
    outline-offset: 2px;
  }
  ```
- **Category**: ux

---

### F-002: Two competing toast notification systems
- **Severity**: high
- **Files**:
  - `toast.tsx` — Custom `ToastProvider` and `useToast()`
  - `providers.tsx` — `<Toaster>` from `sonner`
  - `conversation-list.tsx` L10 — imports `toast` from `sonner`
  - `law-card.tsx` L8 — imports `useToast` from `./toast`
  - `chat/[id]/page.tsx` L22 — imports `toast` from `sonner`
  - `guidance/history/page.tsx` L16 — imports `useToast` from `@/components/toast`
- **Current**: The app registers both `ToastProvider` (in `layout.tsx` L10) and `sonner`'s `<Toaster>` (in `providers.tsx` L23). Some components use the custom toast (`law-card.tsx`, `norm-viewer.tsx`, `guidance/history/page.tsx`), others use sonner (`conversation-list.tsx`, `chat/[id]/page.tsx`). Both render to the bottom-right.
- **Issue**: Two toast systems running concurrently creates visual inconsistency — sonner toasts have a different appearance (rounder, auto-close differently) than the custom toasts. Users see different-styled notifications depending on which component triggered them.
- **Recommendation**: Choose one system and migrate all usages to it. Sonner is more feature-rich (dismiss buttons, swipe-to-dismiss, pause on hover). If keeping the custom toast, remove the sonner `<Toaster>` and migrate `conversation-list.tsx` and `chat/[id]/page.tsx` to `useToast()`.
- **Category**: polish

---

### F-003: Undersized touch targets on several interactive elements
- **Severity**: medium
- **Files**:
  - `nav-bar.tsx` L148 — sign out button: `p-2` with `w-3.5 h-3.5` icon ≈ 28×28px
  - `nav-bar.tsx` L107 — nav links: `px-3 py-1.5` text-only ≈ 12×24px tap area
  - `nav-bar.tsx` L160 — language button: `px-2 py-1.5` ≈ 16×24px tap area
  - `nav-bar.tsx` L232 — mode selector: `px-3 py-1.5` text-only
  - `conversation-list.tsx` L187 — delete button: `p-1` with `w-3 h-3` icon ≈ 20×20px
  - `conversation-list.tsx` L115 — close button: `w-4 h-4` icon with no padding
  - `toast.tsx` L62 — toasts have no close/dismiss button at all
- **Issue**: These elements are below the 44×44px minimum touch target recommendation (WCAG 2.5.8). On mobile, users will struggle to tap accurately.
- **Recommendation**: Increase touch targets. For icon-only buttons, add invisible extension via `before:` pseudo-element or increase padding. Minimum approach:
  - Sign out: change `p-2` to `p-3` (adds 8px → ~36×36px, still tight but better)
  - Delete button: change `p-1` to `p-2.5` (→ ~36×36px)
  - Nav links: already small by design; add `min-h-[44px]` flex container
  - Close button: add `p-2` wrapper around the icon
- **Category**: ux

---

### F-004: No loading/disabled state on SearchBar
- **Severity**: medium
- **File**: `search-bar.tsx` L14-31
- **Current**: `handleSearch` calls `router.push()` synchronously. The buttons have `active:scale-95` pressed state but no `disabled` state. If a user clicks "Search" or "Analyze via AI" multiple times rapidly, multiple navigations are queued. The input remains editable during navigation.
- **Issue**: No visual feedback that the search is being processed. Rapid double-clicks cause redundant navigations. No loading spinner or disabled state while the page transition occurs.
- **Recommendation**: Add a `submitting` state that disables both buttons and optionally replaces the icon with `<Loader2 className="animate-spin" />`:

  ```tsx
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async (e: React.FormEvent, forceChat = false) => {
    if (e) e.preventDefault();
    if (!query.trim() || submitting) return;
    setSubmitting(true);
    // router.push(...)
  };
  ```

  Add `disabled:opacity-50 disabled:cursor-not-allowed` to both buttons. Reset `submitting` after navigation (or let it persist — the component unmounts on navigation anyway).
- **Category**: ux

---

### F-005: Error and info toasts are visually identical
- **Severity**: medium
- **File**: `toast.tsx` L65-69
- **Current**: The toast styling only distinguishes two visual states:
  - `success` → `border-[#888888] text-[#888888]`
  - Everything else (`error` and `info`) → `border-[#2a2a2a] text-[#a3a3a3]`
- **Issue**: Error notifications (e.g., failed bookmark sync) look identical to info notifications. Users cannot distinguish severity at a glance. There is no red/error color used.
- **Recommendation**: Add a distinct error style:

  ```diff
  - "border-[#2a2a2a] text-[#a3a3a3]"
  + t.type === "error"
  +   ? "border-red-900/40 text-red-400"
  +   : "border-[#2a2a2a] text-[#a3a3a3]"
  ```
- **Category**: polish

---

### F-006: Toast notifications lack manual dismiss
- **Severity**: medium
- **File**: `toast.tsx` L62-73
- **Current**: Toasts auto-dismiss after 4000ms with no close button. `role="alert"` is set but there's no mechanism for the user to dismiss early.
- **Issue**: If a user wants to read a toast longer or dismiss it before the timer, they cannot. WCAG 2.2.1 suggests users should be able to pause or dismiss time-based content.
- **Recommendation**: Add a close button to each toast:

  ```tsx
  <div className="flex items-start justify-between gap-3 ...">
    <span>{t.message}</span>
    <button
      onClick={() => setToasts(...)}
      className="shrink-0 text-zinc-600 hover:text-white"
    >
      <X className="w-3 h-3" />
    </button>
  </div>
  ```

  Also consider pausing the timer on hover (`onMouseEnter`/`onMouseLeave`).
- **Category**: ux

---

### F-007: Cost-risk-calculator range slider lacks focus and disabled states
- **Severity**: medium
- **File**: `cost-risk-calculator.tsx` L31-38
- **Current**: The `<input type="range">` has `className="flex-1 accent-accent-cobalt"` with no `focus:` or `disabled:` styles. The input is always enabled.
- **Issue**: Keyboard users navigating to the slider get no visible focus indicator. There's no scenario where the slider is disabled (e.g., while results load), but the pattern doesn't support it.
- **Recommendation**: Add focus styling:

  ```diff
  - className="flex-1 accent-accent-cobalt"
  + className="flex-1 accent-accent-cobalt focus:outline-none focus:ring-2 focus:ring-accent-cobalt/50 disabled:opacity-40"
  ```
- **Category**: polish

---

### F-008: LawCard has no empty state when relevantNorms is empty
- **Severity**: medium
- **File**: `law-card.tsx` L85-99
- **Current**: The `relevantNorms` array is mapped unconditionally in a `space-y-4` container (L85-100). If the array is empty, the container renders nothing visible — an empty div with `space-y-4` still takes up space from the margin collapse above and below, leaving an awkward gap in the card layout.
- **Issue**: A law with 0 matching sections shows an empty gap between the header/footer with no explanatory text. Users may think the card is broken or incomplete.
- **Recommendation**: Add a conditional empty state inside the norms section:

  ```tsx
  {law.relevantNorms.length === 0 ? (
    <p className="text-sm text-zinc-600 italic py-4">
      No matching sections for this search.
    </p>
  ) : (
    <div className="space-y-4">
      {law.relevantNorms.map(...)}
    </div>
  )}
  ```
- **Category**: ux

---

### F-009: Nav-bar user email truncation may hide sign-out action
- **Severity**: low
- **File**: `nav-bar.tsx` L137-138
- **Current**: The username is truncated to `max-w-[120px]` via `truncate`. The sign-out icon button (`p-2` with `w-3.5 h-3.5 LogOut` icon) sits next to it with no visible label, only a `title` attribute.
- **Issue**: The sign-out button has a very small hit target (~28×28px, see F-003) and no visible text label. New users may not realize what the icon does until they hover for the tooltip. On touch devices, `title` tooltips don't appear.
- **Recommendation**: Either enlarge the sign-out button to at least 44×44px, or add a "Sign Out" text beside it that's visible on hover/focus. Consider using `aria-label="Sign out"` (already has `title`).
- **Category**: ux

---

### F-010: ChatMessageBubble lacks text overflow handling for long cited law keys
- **Severity**: low
- **File**: `chat-message-bubble.tsx` L51-58
- **Current**: Cited law links are rendered inside a `flex flex-wrap gap-2` container. Each link shows text like `{law.law_key} {law.norm_id}` with `px-3 py-2` padding and no truncation.
- **Issue**: If a law key is very long (e.g., "EGZPO" or "Einführungsgesetz zum..."), it will overflow the `max-w-[85%]` container without wrapping because the link is a single `<a>` with no `break-all` or `truncate`.
- **Recommendation**: Add `break-all` or `max-w-[200px] truncate` to the law key `<Link>` elements.
- **Category**: polish

---

### F-011: Conversation-list delete confirmation can stack sonner toasts
- **Severity**: low
- **File**: `conversation-list.tsx` L71-103
- **Current**: The `handleDelete` function creates a sonner custom toast with a 10-second duration. The `deleteMutation.onSuccess` also fires `toast.success("Conversation deleted")`. If the user confirms deletion, both the confirmation toast disappears AND a new success toast appears.
- **Issue**: If the user deletes quickly from multiple conversations, old confirmation toasts persist until their timeout or dismissal. The flow works but creates overlapping toast stacks.
- **Recommendation**: This is minor. Consider reducing confirmation duration to 5s. Or consolidate: show the confirmation inline in the list item rather than as a sonner toast.
- **Category**: ux

---

### F-012: CategoryGrid links lack active state
- **Severity**: low
- **File**: `category-grid.tsx` L97-113
- **Current**: Category `<Link>` has `hover:bg-white/[0.03] hover:border-accent-gold/20` and a gold accent bar that animates on hover. But no `active:scale-95` or `active:bg-white/[0.06]` pressed state.
- **Issue**: Users get no tactile feedback that a press is being registered, especially on mobile where there's no hover.
- **Recommendation**: Add `active:scale-[0.97] active:bg-white/[0.05]` to the link classes.
- **Category**: polish

---

### F-013: Guidance-paths-display disclosure pattern uses individual state instead of a collapsible pattern
- **Severity**: low
- **File**: `guidance-paths-display.tsx` L130-135
- **Current**: The expand/collapse uses `expandedPath` state (a single number or null). Only one path can be expanded at a time. The expand/collapse buttons are `<button>` elements with proper `aria-expanded` missing.
- **Issue**: No `aria-expanded` attribute on the expand buttons. Screen reader users get no indication that the button controls an expandable section. The pattern is an accordion, not a disclosure, but neither pattern has proper ARIA.
- **Recommendation**: Add `aria-expanded={isExpanded}` and `aria-controls={`path-content-${path.path_number}`}` to the toggle button. Add `id={`path-content-${path.path_number}`}` to the expanded content div.
- **Category**: polish

---

### F-014: RemediationRoadmap uses index-based keys for mapped steps
- **Severity**: low
- **File**: `remediation-roadmap.tsx` L38-47
- **Current**: The `diagnosis.deadlines.map((d, i) => ...)` uses `i` to generate keys (`id: \`d-${i}\``). The `steps` array and the render loop both use these index-derived keys.
- **Issue**: Index-based keys can cause React reconciliation issues if the deadlines array order changes. While the current data flow likely keeps deadlines stable, using index as key is an anti-pattern.
- **Recommendation**: If `d` has a unique identifier, prefer that. Otherwise this is acceptable given the current stable ordering, but document the assumption.
- **Category**: polish

---

### F-015: Nav-bar mobile menu items lack a close-on-navigation pattern
- **Severity**: suggestion
- **File**: `nav-bar.tsx` L107-122
- **Current**: The 4 main nav links (`/`, `/chat`, `/guidance`, `/bookmarks`) are hidden on mobile (`hidden sm:flex`). On small screens (<640px), there is no mobile hamburger menu or drawer — the navigation disappears entirely.
- **Issue**: On mobile phones (<640px viewport), users have no way to navigate between sections except via the browser back button or typing URLs directly. The user avatar, language selector, and mode selector remain visible but the primary nav links are gone.
- **Recommendation**: Consider adding a hamburger menu that becomes visible below `sm` breakpoint. The dropdown pattern already exists for mode/language — a similar slide-down or slide-in drawer for nav items would solve this.
- **Category**: ux

---

### F-016: CostRiskCalculator value display has no disabled state
- **Severity**: suggestion
- **File**: `cost-risk-calculator.tsx` L40-42
- **Current**: The dispute value display (`€{disputeValue.toLocaleString()}`) is a static `<div>`.
- **Issue**: Minor — if the calculator were to load async data (e.g., fetching fee tables), there's no visual feedback. The component always shows `€5000` as default immediately.
- **Recommendation**: Consider adding a `disabled` or `loading` prop to optionally disable the slider and show a skeleton. For now at least handle future-proofing by wrapping the grid in a loading check.
- **Category**: polish

---

### F-017: ToastProvider has no max visible toast limit
- **Severity**: suggestion
- **File**: `toast.tsx` L56
- **Current**: The toast container renders all toasts in state with no limit.
- **Issue**: If multiple notifications fire in rapid succession (e.g., bulk bookmark operations), the toast stack can grow unbounded, pushing earlier toasts off-screen or creating visual clutter.
- **Recommendation**: Cap visible toasts to 3-5 and queue extras, or use a transition that slides older ones up into a stacked position.
- **Category**: polish

---

### F-018: Missing `cursor-pointer` on interactive elements
- **Severity**: suggestion
- **Files**:
  - `nav-bar.tsx` L148 — sign out button (no cursor-pointer)
  - `law-card.tsx` L46 — bookmark button (no cursor-pointer)
  - `guidance-paths-display.tsx` L200 — expand path button (no cursor-pointer)
  - `remediation-roadmap.tsx` L104 — "Start this step" button (no cursor-pointer)
- **Current**: Several `<button>` elements don't have `cursor-pointer`. Browsers default to `cursor: pointer` for `<button>` in most cases, but some Tailwind resets may override it.
- **Issue**: If the project's base stylesheet overrides button cursor (common in CSS resets), these buttons will show the default text cursor instead of a pointer, confusing users about clickability.
- **Recommendation**: Add `cursor-pointer` to any `<button>` that isn't disabled. Or ensure the Tailwind preflight hasn't been disabled (it normally sets `cursor: pointer` on buttons).
- **Category**: polish
