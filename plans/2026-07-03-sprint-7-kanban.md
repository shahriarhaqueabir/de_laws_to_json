# Sprint 7: Full-Stack Kanban — Polish, Backfill, CI, Document & Retro

> **Phase:** Foundation Hardening + Test Backfill + CI/CD + Documentation + Retrospective
> **Date:** 2026-07-03
> **Method:** Kanban with feature branches + sub-agent orchestration
> **Orchestrator:** Zed Agent (manager)
> **Knowledge Graph:** `graphify-out/GRAPH_REPORT.md` (pre-built)

---

## Knowledge Graph Summary (Top-Level)

**Corpus:** Code (TS/TSX/Python/MD) — 96 communities detected, 6 large, 59 thin, 31 omitted

| Metric | Value |
|--------|-------|
| **God Nodes** (most connected) | `getServerClient()` (42), `errorResponse()` (39), `sanitizeErrorMessage()` (30), `useAuth()` (21), `successResponse()` (18) |
| **Core Communities** | API Responses, Auth/UI Components, DB Connection Mgmt, Qdrant Search, Guidance Engine, Translation Services, Chat Interface |
| **Surprising Edges** | Full-text search migration → Search API Route; Qdrant re-index plan → qdrant.ts; Broker stability plan → broker.py + chat/route.ts |
| **Knowledge Gaps** | 269 isolated nodes (≤1 connection); 31 thin communities; weak cohesion in API Responses (0.055) and Auth/UI (0.060) |
| **Import Cycles** | None detected ✅ |

---

## Phase 0: Pre-Flight Checks (DONE)

| Status | Check | Result |
|--------|-------|--------|
| ✅ | `npm test` (489 tests) | ALL PASSING |
| ✅ | `tsc --noEmit` (strict mode) | CLEAN |
| ✅ | Git branches mapped | 4 local branches |
| ✅ | NPM audit / deps scanned | 17 runtime + 18 dev deps |
| ✅ | Knowledge graph built | 96 communities, graph.html exported |
| ✅ | Supabase schema audited | 12 migrations, 12 tables |
| ✅ | Retrospective read | Sprint 6b complete |
| ✅ | `.env` secrets validated | Supabase, Qdrant, encryption key, Vercel token all present |

---

## Phase 1: Foundation Fixes (In Progress — `phase/1-foundation-fixes`)

> **Goal:** Merge the 3 blocker fixes already implemented, resolve DB schema drift, and ship the pending uncommitted work.

### Tickets

| ID | Ticket | Priority | Owner | Est. | Status |
|----|--------|----------|-------|------|--------|
| P1-01 | Fix norm-viewer parse error | **Critical** | Zed | S | ✅ DONE |
| P1-02 | Fix rate-limiter race condition | **Critical** | Zed | S | ✅ DONE |
| P1-03 | Fix useBrowserAI lint error | **Critical** | Zed | S | ✅ DONE |
| P1-04 | Fix migration 00008 numbering collision | **High** | Zed | S | 🔲 TODO |
| P1-05 | Fix config.toml seed.sql mismatch | **High** | Zed | S | 🔲 TODO |
| P1-06 | Review & stage remaining 29 uncommitted files | **Medium** | Zed | M | 🔲 TODO |
| P1-07 | Merge `phase/1-foundation-fixes` → `main` | **High** | Zed | S | 🔲 GATE |

### P1-04: Migration 00008 Collision

**Problem:** Two files claim version `00008`:
- `00008_norms_fts.sql` (creates `norms` table + FTS)
- `00008_updated_at_indexes.sql` (creates `updated_at` triggers/indexes)

**Fix:** Rename `00008_updated_at_indexes.sql` → `00009_updated_at_indexes.sql` and renumber `00009_rate_limits.sql` → `00010`, etc. Update `00010_rls_norm_explanations.sql` → `00011`, `00011_fulltext_search.sql` → `00012`. Or squash the collision.

### P1-05: Seed File Mismatch

**Problem:** `config.toml` references `./seed.sql` but the actual seed files are named differently.

**Fix:** Update `config.toml` to reference the actual seed files, or create a `seed.sql` wrapper that includes them.

### P1-06: Uncommitted File Review

**Scope:** 29 files changed (+534/-232). Includes:
- `src/app/settings/page.tsx` (+172) — settings page changes
- `src/lib/translate-server.ts` (+102) — server-side translation
- Various config, setup, and test files
- New untracked: `src/app/api/broker/`, `src/components/diagnostic.tsx`, `.agents/`, `.memory/` topics

**Decision gate:** Review each file before staging. Some may need to be split across later phases.

---

## Phase 2: Test Backfill & Quality Gates

> **Goal:** Expand coverage to 65%+, add CI/CD pipeline, backfill integration tests for critical paths.

### Sub-Agent Team

| Role | Agent | Responsibility |
|------|-------|---------------|
| **Orchestrator** | Zed Agent | Coordinates all agents, merges branches, runs gates |
| **Test Engineer 1** | Sub-agent A | Backfill component + hook tests |
| **Test Engineer 2** | Sub-agent B | Backfill API integration tests (MSW-based) |
| **CI/CD Engineer** | Sub-agent C | GitHub Actions pipeline + Knip dead-code analysis |
| **Test Engineer 3** | Sub-agent D | E2E smoke tests (Playwright) |

### Tickets

| ID | Ticket | Priority | Owner | Est. |
|----|--------|----------|-------|------|
| P2-01 | Add component tests for `diagnostic.tsx`, `providers.tsx`, `footer.tsx` | **High** | Agent A | M |
| P2-02 | Add API integration tests for broker endpoints | **Medium** | Agent B | M |
| P2-03 | Add API integration tests for guidance sessions CRUD | **Medium** | Agent B | M |
| P2-04 | Set up GitHub Actions CI (lint + typecheck + test + coverage) | **High** | Agent C | M |
| P2-05 | Set up Knip for dead-code detection | **Medium** | Agent C | S |
| P2-06 | Add Playwright E2E smoke tests (search flow, auth flow) | **Medium** | Agent D | M |
| P2-07 | Backfill norm-viewer edge case tests (empty norms, malformed) | **Low** | Agent A | S |
| P2-08 | Test guidance engine with real Qdrant response mocks | **Medium** | Agent B | M |
| P2-09 | Coverage gate: reject PRs below 60% | **High** | Agent C | S |

### Backfill Strategy (Research-Based)

**Best approach for safe re-runnable backfill:**
1. **Idempotent seed scripts** — All seed SQL should use `INSERT ... ON CONFLICT DO NOTHING` or `DO UPDATE`
2. **Transactional batches** — Each backfill batch wrapped in a transaction; if one fails, only that batch rolls back
3. **Checkpoint tracking** — Create a `_backfill_checkpoints` table tracking which batches completed
4. **Verification step** — After backfill, run `COUNT(*)` comparison + spot-check random samples
5. **Dry-run mode** — Every backfill script has `--dry-run` flag to preview without writing

---

## Phase 3: Performance & Security Hardening

> **Goal:** Audit CSP, harden rate limiting, optimize Qdrant queries, reduce bundle size.

### Sub-Agent Team

| Role | Agent | Responsibility |
|------|-------|---------------|
| **Security Engineer** | Sub-agent E | CSP audit, SSRF review, dependency audit |
| **Performance Engineer** | Sub-agent F | Bundle analysis, Qdrant query optimization, caching |
| **Database Engineer** | Sub-agent G | Query plan analysis, index optimization, migration squash |

### Tickets

| ID | Ticket | Priority | Owner | Est. |
|----|--------|----------|-------|------|
| P3-01 | CSP audit: verify all CDN/wasm sources, test browser mode | **High** | Agent E | M |
| P3-02 | Dependency audit: run `npm audit`, check for known vulns | **Medium** | Agent E | S |
| P3-03 | SSRF review: verify broker URL regex + IP range blocks | **Medium** | Agent E | S |
| P3-04 | Bundle analysis: run `@next/bundle-analyzer`, identify large deps | **Medium** | Agent F | S |
| P3-05 | Qdrant query optimization: reduce scroll payloads, cache results | **Low** | Agent F | M |
| P3-06 | Add response caching layer (SWR headers or in-memory) | **Low** | Agent F | M |
| P3-07 | Squash migrations 00005-00007 (remove dead code) | **High** | Agent G | M |
| P3-08 | Add composite indexes on frequently queried columns | **Medium** | Agent G | S |
| P3-09 | Profile and optimize guidance engine LLM calls | **Low** | Agent F | M |

---

## Phase 4: Feature Polish & UX

> **Goal:** Broker stability, UI polish, error handling, translation accuracy.

### Sub-Agent Team

| Role | Agent | Responsibility |
|------|-------|---------------|
| **Backend Engineer** | Sub-agent H | Broker stability, Ollama integration |
| **Frontend Engineer** | Sub-agent I | UI polish, accessibility, responsive fixes |
| **Content Engineer** | Sub-agent J | Translation accuracy, legal content review |

### Tickets

| ID | Ticket | Priority | Owner | Est. |
|----|--------|----------|-------|------|
| P4-01 | Broker stability: implement health checks, auto-reconnect | **High** | Agent H | M |
| P4-02 | Broker error handling: surface Ollama errors in UI | **Medium** | Agent H | S |
| P4-03 | UI: fix loading states on search results page | **Medium** | Agent I | S |
| P4-04 | UI: responsive fixes for guidance history page | **Low** | Agent I | S |
| P4-05 | UI: add empty-state illustrations for bookmarks | **Low** | Agent I | S |
| P4-06 | Accessibility: run axe audit, fix violations | **Medium** | Agent I | M |
| P4-07 | Translation: verify all 9 languages render without overflow | **Medium** | Agent J | S |
| P4-08 | Error boundaries: add per-page error fallbacks | **Medium** | Agent I | S |
| P4-09 | Law card: show last_changed date in user-friendly format | **Low** | Agent I | S |

---

## Phase 5: Documentation & Final Retro

> **Goal:** Comprehensive documentation, architecture decision records, final retrospective, knowledge graph update.

### Sub-Agent Team

| Role | Agent | Responsibility |
|------|-------|---------------|
| **Technical Writer** | Sub-agent K | ADRs, README update, API docs |
| **Analyst** | Sub-agent L | Final retrospective, metrics, knowledge graph |
| **Orchestrator** | Zed Agent | Merge all branches, final review gate |

### Tickets

| ID | Ticket | Priority | Owner | Est. |
|----|--------|----------|-------|------|
| P5-01 | Update README with latest architecture diagram | **High** | Agent K | M |
| P5-02 | Write ADR for hybrid search decision (dense + BM25) | **Medium** | Agent K | S |
| P5-03 | Write ADR for rate limiter architecture (Supabase-backed) | **Medium** | Agent K | S |
| P5-04 | Update `docs/production.md` with current deployment topology | **Medium** | Agent K | M |
| P5-05 | Update `docs/security-architecture.md` with latest mitigations | **High** | Agent K | M |
| P5-06 | Run knowledge graph update (`graphify --update`) | **Medium** | Agent L | S |
| P5-07 | Write sprint 7 retrospective | **Low** | Agent L | S |
| P5-08 | Generate coverage report and burn-down chart | **Low** | Agent L | S |
| P5-09 | Final review gate: verify all phases meet acceptance criteria | **High** | Zed | M |

---

## Feature Branch Strategy

```
main
├── phase/1-foundation-fixes    ← ACTIVE (in progress)
├── phase/2-test-backfill       ← NEXT
├── phase/3-perf-security       ← PLANNED
├── phase/4-feature-polish      ← PLANNED
└── phase/5-docu-retro          ← PLANNED
```

Each phase branches from `main`, implements its tickets, then PR-merges back to `main`. Sequential, not parallel — each phase depends on the stability of the previous one.

---

## Sub-Agent Orchestration Protocol

### Agent Dispatch Template

Each sub-agent call follows this structure:

```
Task(
    description="<role-specific brief>",
    context={
        "branch": "<phase-branch>",
        "files": ["<affected file paths>"],
        "dependencies": ["<env vars, services needed>"],
        "verification": "<how to verify success>"
    }
)
```

### Communication Flow

```
Orchestrator (Zed Agent)
    ├── Dispatches agents per phase
    ├── Collects results + diffs
    ├── Runs verification gates
    ├── Escalates failures with RCA
    └── Presents summary tickets to user for approval
```

### Verification Gates

| Gate | When | What |
|------|------|------|
| **Pre-flight** | Before each phase | `npm test` passes, `tsc --noEmit` clean |
| **Per-ticket** | After each ticket | Ticket-specific verification (see ticket definition) |
| **Phase gate** | Before merge to main | Full test suite + typecheck + coverage check |
| **Final gate** | Before closing Sprint 7 | All phases merged, docs updated, retro written |

---

## Environment & Secrets Policy

- **`.env` file read only once** at session start — never hardcode, forget after use
- **Supabase keys**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable), `SUPABASE_ACCESS_TOKEN` (service)
- **Qdrant**: `QDRANT_URL` + `QDRANT_API_KEY`
- **Encryption**: `SERVER_ENCRYPTION_KEY` for AES-256-GCM
- **Vercel**: `VERCEL_TOKEN` for deployment access
- **All secrets redacted** from outputs, logs, and commit messages via gitleaks pre-commit hook

---

## Key Findings & Risks

| Finding | Severity | Mitigation |
|---------|----------|------------|
| Migration 00008 naming collision | **High** | Renumber in Phase 1 |
| Seed SQL path mismatch in config.toml | **High** | Fix in Phase 1 |
| Schema dead code (00005 → 00007 churn) | **Medium** | Squash in Phase 3 |
| No local CI/CD pipeline | **Medium** | Add in Phase 2 |
| 178 MB laws.db at root | **Low** | Add to .gitignore if not needed |
| Browser AI mode blocked by CSP | **Medium** | Audit in Phase 3 |
| Weak cohesion in API Responses community (0.055) | **Low** | Consider splitting in Phase 4 |
| 269 isolated knowledge graph nodes | **Low** | Document in Phase 5 |

---

## Next Steps — Your Decision Required

**Phase 1 is in progress.** I need your approval on:

1. **P1-04 Migration fix approach**: Option A — renumber files (preserves history), Option B — squash into a single migration (cleaner but changes hashes)
2. **P1-06 Staged files**: Do you want me to review and commit the 29 pending files now, or split some into later phases?
3. **Phase ordering**: Current plan is sequential (1→2→3→4→5). Do you want any parallel phases?
4. **Sub-agent activation**: I'll dispatch the specialized agents as we enter each phase. Confirm you're comfortable with this pattern.

Review the tickets above and let me know your decisions. I'll then begin executing Phase 1.
