# ADR-009: Cookie-based Language Hydration

**Date**: 2026-07-05
**Status**: accepted
**Deciders**: AI Assistant

## Context

The application currently stores the user's language and text direction preference in `localStorage`. This state is only accessible on the client side. Consequently, the server-rendered HTML always defaults to English (`lang="en"`) and Left-to-Right (`dir="ltr"`).

When a non-English user visits the site, the browser first paints the default English layout. Then, after hydration, the `LangProvider`'s `useEffect` runs, reads `localStorage`, and updates the `<html>` attributes. This causes a visible "hydration flicker" where the layout may suddenly flip (for RTL) or system fonts may change.

## Decision

Migrate the primary storage for UI language and text direction from `localStorage` to **Cookies**.

1. **Server-Side Access**: Next.js server components (specifically the root `layout.tsx`) will read the `glv_lang` cookie to set the `lang` and `dir` attributes on the `<html>` tag during the initial request.
2. **Client-Side Sync**: The `useLanguage` hook and `OnboardingWizard` will update the cookie whenever the language is changed.
3. **Graceful Fallback**: If no cookie is present, default to `en`/`ltr`.

## Alternatives Considered

### Alternative 1: URL-based Routing (e.g., `/en/search`, `/de/search`)
- **Pros**: Strongest SEO, naturally eliminates flicker.
- **Cons**: Requires a massive routing refactor and complex middleware. Overkill for a tool where language is a user preference rather than a locale-specific content fork.

### Alternative 2: Script Injection (Inlining localStorage read in <head>)
- **Pros**: Fixes flicker without cookies.
- **Cons**: Next.js 16/15 makes inlining scripts in `<head>` more complex with App Router. Doesn't allow the server to know the language for metadata or other server-side optimizations.

## Consequences

### Positive
- **Instant Paint**: Users see the correct layout and language immediately on page load.
- **Improved SEO**: Search engines receive the correct `lang` attribute in the initial HTML.
- **Consistency**: Server and client are always in sync regarding the UI locale.

### Negative
- **Cookie Overhead**: Adds a small amount of data (~2 bytes) to every HTTP request.
- **RSC Limitations**: Setting cookies from within a Server Component requires an action or an API route; simple UI selection must use client-side `document.cookie` or a specialized hook.

### Risks
- Users with cookies disabled will revert to English (acceptable given the low percentage of such users).
