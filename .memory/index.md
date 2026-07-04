# German Law Vault — Memory Index

## Active Sprint: Sprint 8 — ✅ Complete

| Topic | File | Last Updated | Status |
|-------|------|-------------|--------|
| Sprint 8 Kanban | `plans/2026-07-04-sprint-8-onboarding-translation-feature-gating.md` | 2026-07-04 | ✅ Complete |
| Sprint 8 Handoff | `topics/sprint-8-handoff.md` | 2026-07-04 | ✅ Complete |

## What Was Done

- ✅ **O-01**: Async `useApiKeyStatus` hook for cloud-mode gating
- ✅ **O-02**: Chat send button gated per mode (cloud→api-key, local→broker)
- ✅ **O-03**: Guidance retry button gated
- ✅ **O-04**: Mode-specific FeatureGate tooltips (cloud/local/browser)
- ✅ **O-05**: Real i18n translations generated (8 files, 93 keys each, via Ollama)
- ✅ **O-06**: Home page hardcoded strings migrated to i18n (`t()` calls)
- ✅ **O-07**: Search bar gunmetal leather texture + Lady Justice watermark
- ✅ **O-08**: NormViewer auto-section-translate on expand

## Verification

- **Tests**: 500/518 passing (18 pre-existing failures, unchanged)
- **TypeScript**: Clean (0 errors)

## Pre-existing Failures (not caused by sprint)
- 18 norm-viewer test failures — from prior component rewrite
- 1 nav-bar test failure — `getByText("EN")` vs DOM lowercase "en"

## New Artifacts
- `src/hooks/useApiKeyStatus.ts` — async API key status hook
- `scripts/translate-i18n.ts` — batch translation script (reusable)
- `src/app/metadata.ts` — extracted metadata for i18n home page
- `src/lib/i18n/{de,tr,ar,fr,es,pl,uk,ru}.ts` — real translations, not `...EN` stubs
