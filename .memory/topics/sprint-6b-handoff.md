# Sprint 6b Handoff — Hybrid Search + FTS Migration

## Goal

Fix all remaining blockers for Sprint 6 of German Law Vault:
1. ✅ **Browser AI WASM loading** — done
2. ✅ **Hybrid search (application-level BM25 fusion)** — DONE
3. 🔶 **Full-text search fallback in Supabase** — table created, backfill interrupted
4. ⏳ **Evaluation benchmark** — not started
5. ⏳ **Tune hybrid alpha** — not started

## Completed

### B2: Hybrid Search
Rewrote `qdrant.ts` to replace the broken Qdrant prefetch API with application-level BM25 fusion:
- Dense E5 query → client-side BM25 scoring → normalized fusion with alpha=0.7
- Keyword reranking + law diversity boost
- Tests passing (6/6)

### B1: Collection Seeded
- 107,255 points, 211,935 indexed vectors, green status
- `laws.db` and `norms_vectors.npy` intact

### C1: Norms Postgres Table Created
- `supabase/migrations/00008_norms_fts.sql` applied
- GIN trigram index on content
- RLS enabled (public read)

### Seed Script Fixed
- `wait=False` → `wait=True`
- Early-exit when collection already seeded

## Blocked / In Progress

### C2: Backfill Norms to Supabase (INTERRUPTED)
The script was run with the OLD version that only accepted status 200. Supabase Management API returns **201** (Created) for successful INSERT operations. The fix is applied (accepts 200 or 201) but the full backfill was only ~60% done when interrupted.

**To re-run:**
```bash
QDRANT_URL='...' QDRANT_API_KEY='...' SUPABASE_ACCESS_TOKEN='...' \
scripts/.venv/Scripts/python scripts/backfill_norms_to_supabase.py
```
Uses `ON CONFLICT DO UPDATE`, so re-running is safe/idempotent.

## Key Files Changed

| File | Change |
|------|--------|
| `nextjs/src/lib/qdrant.ts` | Replaced prefetch with application-level BM25 fusion |
| `nextjs/src/lib/__tests__/qdrant.test.ts` | Updated test expectations (6/6 pass) |
| `scripts/seed_norms_to_qdrant.py` | `wait=True`, early-exit |
| `scripts/backfill_norms_to_supabase.py` | NEW - Qdrant scroll → Supabase upsert |
| `supabase/migrations/00008_norms_fts.sql` | NEW - norms table + GIN trigram index |

## Pitfalls

1. **Supabase Management API status 201**: `/database/query` returns 201 for INSERT, not 200.
2. **Qdrant managed inference + sparse vectors**: The prefetch API with `sparse: "bm25"` doesn't work with managed inference text queries. Application-level BM25 fusion is required.
3. **MCP tools auth**: Supabase MCP tools are NOT authenticated with SUPABASE_ACCESS_TOKEN. Use Management API REST endpoint directly.
4. **Python path**: Use `scripts/.venv/Scripts/python` for scripts in `scripts/`.
5. **AVG_DOC_LENGTH**: Set to 600 in `qdrant.ts` — rough estimate.
