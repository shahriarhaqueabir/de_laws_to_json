# Sprint 6b: Hybrid Search + FTS Migration + Eval

> **Kanban Sprint Plan** — Fix remaining blockers after data recovery.

**Goal:** Ship working hybrid BM25+dense search, production full-text fallback, and evaluation benchmark

**Current State:** Collection "german_norms" has 107,255 points (211,935 indexed vectors), green status. Laws DB and embedding cache intact. Browser AI WASM fix is done.

---

## Sprint Board

| Status | Card | Owner | Est. |
|--------|------|-------|------|
| ✅ DONE | D1: Write evaluation script using GerLayQA | — | — |
| ✅ DONE | A1: Wire browser mode to web worker | — | — |
| ✅ DONE | A2: Add WASM loading fallback in worker | — | — |
| ✅ DONE | A3: Relax COOP/COEP + verify CSP | — | — |
| ✅ DONE | B1: Re-index Qdrant with sparse BM25 vectors | — | — |
| ✅ DONE | B2: Fix searchNorms() for hybrid query | Zed | S |
| ✅ DONE | C1: Create norms Postgres table + migration | Zed | S |
| ✅ DONE | C2: Backfill norms from Qdrant scroll (107,256 rows) | Zed | M |
| ✅ DONE | C3: Add full-text fallback in search API route | Zed | M |
| ✅ DONE | D2: Run baseline eval against Qdrant | Zed | S |
| ✅ DONE | B3: Tune hybrid alpha | Zed | M |
| ✅ DONE | C4: End-to-end verification | Zed | S |

---

## Card B2: Fix Hybrid Search Query

**Problem:** `searchNorms()` in `qdrant.ts` uses `@qdrant/js-client-rest` prefetch API with managed inference for the sparse query. Qdrant's managed inference API (`query.text + query.model`) doesn't support sparse vector queries from named keys. The sparse query must provide native sparse vectors, not managed inference text.

**Solution:** Implement application-level hybrid: run two separate queries (dense managed + client-side BM25 scoring) → merge results with alpha weight.

**Files:**
- `nextjs/src/lib/qdrant.ts` — modify `searchNorms()`
- Add BM25 scoring utility

**Steps:**
1. Replace the `prefetch` block with two sequential queries
2. Compute BM25 scores client-side for dense results
3. Merge with alpha weight, re-sort
4. Keep error fallback chain

See implementation details below.

---

## Card C1: Create norms Postgres table + migration

**Files:**
- `supabase/migrations/00008_norms_fts.sql`

Create a `norms` table matching the Qdrant payload schema, with GIN trigram index for German full-text search:

```sql
-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS norms (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  law_key     TEXT NOT NULL,
  law_title   TEXT,
  category    TEXT DEFAULT 'other',
  norm_id     TEXT NOT NULL,
  norm_title  TEXT,
  content     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_norms_law_key ON norms (law_key);
CREATE INDEX idx_norms_norm_id ON norms (norm_id);
CREATE INDEX idx_norms_category ON norms (category);
CREATE INDEX idx_norms_content_trgm ON norms USING GIN (content gin_trgm_ops);

-- Enable row-level security but allow public read
ALTER TABLE norms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Norms are publicly readable" ON norms FOR SELECT USING (true);
```

---

## Card C2: Backfill norms from Qdrant scroll

**Files:**
- `scripts/backfill_norms_to_supabase.py`

Scroll all 107K points from Qdrant, batch-upsert into Supabase `norms` table using the `@supabase/supabase-js` or REST API.

Flow:
1. Scroll Qdrant collection with `with_payload: true` (no vectors needed)
2. Batch into groups of 500
3. Upsert via Supabase REST API using service_role key
4. Verify row count matches

---

## Card C3: Add full-text fallback in search API route

**Files:**
- `nextjs/src/app/api/search/route.ts` — modify

When Qdrant returns < 3 results or throws, fall back to Postgres trigram search:

```sql
SELECT * FROM norms
WHERE content % $1 OR content ILIKE '%' || $1 || '%'
ORDER BY GREATEST(similarity(content, $1), 0.1) DESC
LIMIT 20;
```

This uses pg_trgm similarity + ILIKE as a catch-all.

---

## Card D2: Run baseline eval

Use the GerLayQA `bgb_eval.json` to measure MRR@10 and Recall@10 against current dense-only Qdrant.

Run from `scripts/`:

```bash
.venv/Scripts/python evaluate_search.py
```

Report:
- MRR@10: 0.0461
- Recall@10: 0.0633
- Average response time: ~200ms
- Best Alpha: 0.85
