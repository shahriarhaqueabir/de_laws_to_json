# Sprint 7: Polish Sprint — Kanban Board

**Branch**: `phase/2-knowledge-graph` (current) → `phase/6-docs-retro`
**Base**: `6a53bec` (Phase 0–5 complete, Phase 2 partial)
**Tests**: 50 files, 516 tests — all passing

---

## Phase Order

> Phase 6 (Docs/Retro) and Phase 2 (Knowledge Graph) are last.
> Execute remaining phases in recommended order.

### Phase 2 — Knowledge Graph & Error Handling

| ID | Ticket | Status | Priority | Description |
|----|--------|--------|----------|-------------|
| P2-01 | **Rebuild knowledge graph** | ✅ DONE | Medium | 1440 nodes, 2060 edges, 170 communities. God nodes: getServerClient, errorResponse, sanitizeErrorMessage. |
| P2-02b | **Catch-block sanitization** | ✅ DONE | High | 4 routes fixed + 1 stray try{} bug in guidance/route.ts + 1 test shape fix. 516/516 passing. |

### Phase 6 — Documentation & Retro

| ID | Ticket | Status | Priority | Description |
|----|--------|--------|----------|-------------|
| P6-01 | **Update README** | ✅ DONE | High | Badge 308→516. Added Qdrant cache, broker health features. |
| P6-02 | **Write ADR: hybrid search** | ✅ DONE | Medium | ADR-005: dense+BM25 rationale, fallback chain, benchmark results. |
| P6-03 | **Write ADR: rate limiter** | ✅ DONE | Medium | ADR-006: Supabase-backed design, tier limits, migration details. |
| P6-04 | **Update production.md** | ✅ DONE | Medium | Migrations→00013, cache, broker, E2E, skeletons, a11y added. |
| P6-05 | **Update security-architecture.md** | ✅ DONE | Medium | Last updated→2026-07-03, rate limit headers, Qdrant data handling. |
| P6-06 | **Knowledge graph refresh** | ✅ DONE | Low | Already complete (1440 nodes, 2060 edges — covers all phases) |
| P6-07 | **Write Sprint 7 retro** | ✅ DONE | Medium | Stats, lessons, open items documented. |
| P6-08 | **Final review gate** | ✅ DONE | High | Security scan passed. TS clean. 516/516 tests. Lint 0 errors. Gitleaks ready. |

---

## Security & Pre-Commit

| ID | Item | Status | Description |
|----|------|--------|-------------|
| SC-01 | **Gitleaks scan** | 🔲 TODO | Run pre-commit hook on all staged changes |
| SC-02 | **Secret audit** | 🔲 TODO | Verify no secrets in git history or staged files |
| SC-03 | **Stage + gitignore final** | 🔲 TODO | Ensure `graphify-out/` is gitignored, stage everything needed |

---

## Execution Plan

### Phase 2 (2 tickets)

1. **P2-02b**: Fix catch-block sanitization in 4 routes
   - `src/app/api/broker/manage/route.ts` (line 218)
   - `src/app/api/guidance/sessions/route.ts` (line 68)
   - `src/app/api/guidance/sessions/[id]/route.ts` (lines 48, 79)
   - `src/app/api/settings/api-key/status/route.ts` (line 46)

2. **P2-01**: Rebuild knowledge graph
   - Run `graphify .` from project root
   - Read GRAPH_REPORT.md
   - Summarize god nodes, surprising connections, communities

### Phase 6 (8 tickets)

1. **P6-08**: Final review gate (security scan, gitleaks)
2. **P6-01**: Update README.md
3. **P6-02**: ADR — hybrid search (docs/adr/000X-hybrid-search.md)
4. **P6-03**: ADR — rate limiter (docs/adr/000X-rate-limiter.md)
5. **P6-04**: Update production.md
6. **P6-05**: Update security-architecture.md
7. **P6-06**: Knowledge graph refresh
8. **P6-07**: Sprint 7 retro

---

## Branch Strategy

```
phase/2-knowledge-graph  ← CURRENT (all phases 0-5 + partial 2)
  └→ (complete Phase 2 here)
       └→ phase/6-docs-retro  ← (Phase 6 work)
            └→ (stage & flag for push)
```

No merging to main without user approval.

---

## Tests to Run After Changes

```bash
cd nextjs && npx vitest run       # Unit tests
cd nextjs && npx tsc --noEmit     # Type check
cd nextjs && npm run lint          # Lint
```

## Pre-Push Checklist

- [ ] All tests passing
- [ ] No `console.log` of secrets
- [ ] `graphify-out/` in `.gitignore`
- [ ] Gitleaks clean
- [ ] User manually pushes
