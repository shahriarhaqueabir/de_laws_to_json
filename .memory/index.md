# German Law Vault — Memory Index

## Active Sprint: Sprint 6b — Hybrid Search + FTS Migration

| Topic | File | Last Updated | Status |
|-------|------|-------------|--------|
| Sprint 6b Handoff | `topics/sprint-6b-handoff.md` | 2026-07-02 | Active |
| Sprint Plan (Kanban) | `plans/2026-07-02-sprint-6b-kanban.md` | 2026-07-02 | Active |

## Key Context

- **Architecture**: Next.js 16 + Supabase + Qdrant Cloud (E5-small)
- **Collection**: `german_norms` — 107,255 points, 211,935 indexed vectors
- **Qdrant**: Managed inference E5-small, 384d dense + BM25 sparse
- **Supabase ref**: `zuhhimmdlnsjuwksitpb`

## What's Done
- ✅ Browser AI WASM loading
- ✅ Hybrid search (application-level BM25 fusion in `qdrant.ts`)
- ✅ Qdrant collection seeded with wait=True + dedup fix
- ✅ Norms Postgres table + GIN trigram index (migration 00008)
- ✅ Backfill script fixed (accepts status 200 or 201)

## What's In Progress
- 🔶 C2: Backfill norms from Qdrant → Supabase (interrupted at ~60%)
- ⏳ C3: Full-text fallback in `/api/search`
- ⏳ D2: Evaluation benchmark (GerLayQA)
- ⏳ B3: Tune hybrid alpha

## Credentials (local only, do not persist)
Stored in `.env` at project root. Supabase anon key + service role + Qdrant API key available.
