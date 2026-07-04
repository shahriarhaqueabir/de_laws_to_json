# Sprint 8: Onboarding Polish + Translations + Feature Gating

**Theme**: Close the onboarding loop, fill real translations, gate remaining features.

**Baseline**: 500/518 tests pass (18 pre-existing norm-viewer failures). TypeScript clean.

---

## Tickets

| ID | Ticket | Status | Priority | Files | DOD |
|----|--------|--------|----------|-------|-----|
| O-01 | **Async API key status detection** | ✅ DONE | **High** | `src/hooks/useApiKeyStatus.ts` | - [x] Hook created: `useApiKeyStatus()` → `{ hasStoredKey, loading, error, provider }` - [x] Handles: not signed in, signed in + key, signed in no key, fetch error - [x] 49/51 test files pass (pre-existing failures only) |
| O-02 | **Chat send button feature-gating** | ✅ DONE | **High** | `src/app/chat/page.tsx` | - [x] Cloud mode gated on `api-key` requirement with `useApiKeyStatus` - [x] Local mode gated on `ai-mode-local` with `brokerAvailable` - [x] Basic/browser: no gate - [x] Pre-existing test failures only |
| O-03 | **Guidance retry button feature-gating** | ✅ DONE | **High** | `src/app/guidance/page.tsx` | - [x] Retry button wrapped in same `FeatureGate` as submit - [x] Pre-existing test failures only |
| O-04 | **Mode-specific FeatureGate tooltips** | ✅ DONE | **Medium** | `src/components/feature-gate.tsx` | - [x] Cloud: "Configure an API key..." - [x] Local: "Start your local broker..." - [x] Browser: "Browser AI needs ~1GB download..." - [x] No breaking API changes |
| O-05 | **Generate real i18n translations** | ✅ DONE | **Medium** | `src/lib/i18n/{de,tr,ar,fr,es,pl,uk,ru}.ts` | - [x] All 8 language files have real translations (not `...EN`) - [x] 93 keys × 8 languages = 744 strings translated via Ollama mistral:latest - [x] Script created at `scripts/translate-i18n.ts` for re-runs - [x] TS compiles clean
| O-06 | **Home page hardcoded string i18n** | ✅ DONE | **Medium** | `src/app/page.tsx`, `src/app/metadata.ts`, `src/lib/i18n/en.ts` | - [x] All hardcoded strings migrated to `t()` calls - [x] Metadata extracted to separate file - [x] 13 new i18n keys added to EN + 8 language files - [x] TS clean, tests pass |
| O-07 | **Search bar background texture** | ✅ DONE | **Low** | `src/app/page.tsx`, `src/app/globals.css` | - [x] CSS noise overlay (`bg-noise` with feTurbulence) at `opacity-[0.12]` - [x] `.bg-gunmetal-leather` crosshatch texture - [x] Lady Justice SVG watermark at `opacity-[0.03]` - [x] No test regressions |
| O-08 | **NormViewer auto-section-translate on expand** | ✅ DONE | **Low** | `src/components/norm-viewer.tsx` | - [x] `useEffect` triggers `fetchExplanation()` on expand when AI mode active - [x] Edge cases: already loaded, already loading, basic mode, error all covered - [x] Manual button fallback preserved - [x] Pre-existing test failures only |

---

## Dependency Graph

```
O-01 (Async key detection) ──→ O-02 (Chat gate)
                            ──→ O-03 (Retry gate) ──→ O-04 (Tooltips)
O-05 (Translations) ──→ O-06 (Home page i18n)

O-07 (Background texture) ── independent
O-08 (Auto-translate) ──→ depends on norm-viewer stability
```

**Execution order**: O-01 → O-02 + O-03 → O-04 → O-05 → O-06 → O-07 → O-08

---

## Execution Plan

### Batch 1 (Parallel — 2 agents)
1. **O-01**: Create API key status hook/module
2. **O-05**: Run AI batch translation script for all 8 languages

### Batch 2 (Sequential, depends on O-01)
3. **O-02**: Gate chat send button
4. **O-03**: Gate guidance retry button
5. **O-04**: Mode-specific tooltips on FeatureGate

### Batch 3 (Polish)
6. **O-06**: Home page i18n migration
7. **O-07**: Background texture
8. **O-08**: Auto-translate on expand

---

## Verification

```bash
cd nextjs && npm test          # All tests passing
cd nextjs && npx tsc --noEmit  # TypeScript clean
cd nextjs && npm run lint       # Lint clean
```

## Pre-existing Failures (not caused by this sprint)

- 18 norm-viewer test failures — from prior component rewrite
- 1 nav-bar test failure — `getByText("EN")` vs DOM lowercase "en"
