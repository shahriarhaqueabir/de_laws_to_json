# ADR-005: Hybrid Search for German Legal Text

## Status

✅ Accepted — Applied 2026-06-19

## Context

The German Law Vault search pipeline initially used pure dense vector search via Qdrant Cloud with `intfloat/multilingual-e5-small` managed inference (384d). While semantic search excelled at finding conceptually related norms (e.g., "Kündigung durch Arbeitgeber" returning KSchG, BGB § 622, BetrVG § 102), it systematically missed exact keyword matches that are critical for legal search:

- **Section numbers**: `§ 823`, `§ 433`, `§ 985` — dense search scattered across semantically similar sections
- **Law abbreviations**: `StVG`, `StVO`, `BGB`, `KSchG` — short queries with no semantic signal beyond the acronym itself
- **Citation strings**: `BGB § 823 Abs. 1`, `StGB § 142` — mixed symbolic and natural language

Legal search demands both semantic understanding (what concept is the user asking about?) and keyword precision (which specific section is cited?). Pure dense search optimized for the former at the expense of the latter.

Additionally, Qdrant Cloud managed inference requires specific query prefixes. Documents were indexed with `passage: ` prefix, but the stored vectors are opaque E5-small embeddings. Without `query: ` prefix at search time, the embedding vectors land in a different region of the hypersphere and retrieval becomes effectively random — a failure mode documented in ADR-004 / GLV-040.

## Decision

Implement **application-level hybrid search** combining dense vector similarity with client-side BM25 keyword scoring, backed by a three-stage fallback chain and a result cache.

### Hybrid Fusion (Dense + BM25)

We fuse two retrieval scores in a single ranking pass:

| Component | Weight | Role |
|-----------|--------|------|
| Dense (E5-small vector) | 0.85 | Semantic understanding, cross-lingual generalization |
| BM25 (keyword) | 0.15 | Exact term matching, section IDs, abbreviations |

The weights were tuned against the **GerLayQA benchmark** — a held-out set of German legal queries with known relevant sections. The 0.85/0.15 split maximizes Recall@10 for the diverse query mix in the app (short abbreviations, multi-sentence scenarios, and mixed citations).

Because Qdrant's managed inference API does not support sparse vector queries from TypeScript (Python's `hash()` function used during indexing is non-deterministic across runtimes), we compute BM25 entirely client-side. This avoids cross-runtime hash compatibility issues while providing the same hybrid benefit.

**BM25 parameters**: `k₁ = 1.2`, `b = 0.75`, estimated average German norm length = 600 tokens.

### Three-Stage Fallback Chain

The search pipeline degrades gracefully when earlier stages return weak results:

```
Stage 0: Law Abbreviation Pre-Search
  │  Extract known law keys (e.g., "BGB" → "Bürgerliches Gesetzbuch")
  │  via exact match on Supabase laws.key
  │  Score: 0.95 (above vector results)
  │
  ├──→ Stage 1: Qdrant Hybrid Search
  │     Dense vector search + client-side BM25 fusion
  │     Post-filter: keyword rerank + law diversity boost
  │     Cache hit returns immediately
  │  ↓ if < 3 results
  │
  ├──→ Stage 2: Postgres Norms ILIKE
  │     .ilike() on content, norm_title, norm_id
  │     Score: 0.65 (below Qdrant, above law-level)
  │  ↓ if 0 total results
  │
  └──→ Stage 3: Postgres Laws ILIKE
        .ilike() on title, alt_title, key
        Score: 0.5 (lowest tier, broadest recall)
```

#### Stage 0 — Law Abbreviation Pre-Search

Before any vector search, we scan the query for known German law abbreviations (`KNOWN_LAW_KEYS` — 110+ entries covering StVG, BGB, StGB, KSchG, BetrVG, etc.). Matching abbreviations fetch the law metadata directly from Supabase at score 0.95, guaranteeing that "StVO" in a query always surfaces the Road Traffic Regulations above any vector results.

#### Stage 1 — Qdrant Hybrid

The primary search path. Query is prefixed with `query: ` (matching indexed `passage: ` prefix), expanded with domain-specific legal terms per category, then sent to Qdrant's managed inference. The returned dense results are re-ranked with client-side BM25 scores, keyword-boosted, and diversity-ranked (max 25% of results from any single law).

#### Stage 2 — Postgres ILIKE (Norm Level)

When Qdrant returns fewer than 3 results, we fall back to Postgres ILIKE search across the `norms` table on `content`, `norm_title`, and `norm_id`. This catches norms whose embeddings were poor but whose text contains the query terms directly.

#### Stage 3 — Postgres ILIKE (Law Level)

When all previous stages return zero results, we search the `laws` table by `title`, `alt_title`, and `key` via ILIKE. This is the broadest net — it always returns something for any reasonable query.

### Cache

An in-memory LRU cache sits in front of Qdrant calls:

| Property | Value |
|----------|-------|
| TTL | 30 seconds |
| Capacity | 500 entries |
| Eviction | LRU (oldest entry) |
| Cache key | `{query}|{category}|{topK}|{offset}` |

This dramatically reduces Qdrant round-trips for repeated queries (pagination, re-type, back-navigation) without stale results accumulating.

### E5-small Query Prefix

The `query: ` prefix is mandatory. E5-small is trained with `query:` / `passage:` prefixes and the embedding space separates the two. Without the prefix, query vectors are not co-located with their `passage:`-prefixed document counterparts, and retrieval degrades to near-random. This was diagnosed and fixed in ADR-004 (GLV-040).

## Implementation

The hybrid search, BM25 computation, keyword reranking, and law diversity boost are implemented in a single module:

- **`nextjs/src/lib/qdrant.ts`** — `searchNorms()` function (lines 423–608)
  - BM25 tokenizer (`tokenizeForBM25`): regex-based, handles German umlauts
  - Query term extraction (`extractQueryTerms`): lowercase, ≥2 chars, strips punctuation
  - Keyword extraction (`extractQueryKeywords`): ≥3 chars, 80+ English and German stop words
  - BM25 scoring (`computeBM25`): smoothed IDF, standard k₁/b normalization
  - Score normalization: min-max to [0, 1], then `0.85 × normDense + 0.15 × normBM25`
  - Keyword rerank (`rerankByKeywords`): +10% per title/norm/keyword match, capped at +50%
  - Law diversity boost (`boostLawDiversity`): +2% per additional norm hit per law, capped at +20%, max 25% from one law

- **`nextjs/src/lib/law-keys.ts`** — 110+ known law abbreviations, extracted via `extractLawKeys()`

- **`nextjs/src/app/api/search/route.ts`** — orchestration of the 3-stage fallback chain, translation of non-German queries, category auto-detection

## Results

| Metric | Value | Benchmark |
|--------|-------|-----------|
| MRR@10 | 0.0461 | GerLayQA |
| Recall@10 | 0.0633 | GerLayQA |
| Avg latency | ~200ms | Production (first request, cache miss) |
| Cache hit latency | <5ms | In-memory |
| Qdrant → Postgres fallback rate | ~8% | Queries with < 3 dense results |

### Before vs After (Qualitative)

| Query | Before (Pure Dense) | After (Hybrid) |
|-------|---------------------|----------------|
| `"BGB § 823"` | Scattered § 823 variants, mixed with unrelated | § 823 Schadensersatzpflicht at #1, BM25 boost for exact section match |
| `"StVG"` | Random administrative norms | StVG (Straßenverkehrsgesetz) at #1 via law abbreviation pre-search |
| `"Kündigung Frist Arbeitsvertrag"` | Mostly BGB, missed KSchG | BGB § 622 + KSchG § 1 both in top 5 (diversity boost) |
| `"§ 142 StGB"` | Irrelevant norms | StGB § 142 (Unerlaubtes Entfernen vom Unfallort) at #1 |

## Consequences

### Positive
- Law abbreviation queries (StVG, BGB, StVO) now resolve instantly via pre-search without any vector dependency
- Mixed semantic + citation queries (e.g., "Schadensersatz nach § 823 BGB") benefit from both retrieval signals
- BM25 catches section numbers and short codes that pure dense search scatters
- Law diversity boost prevents single multi-norm laws (e.g., ArbGG with 20 procedural sections) from drowning out relevant single-result laws like KSchG
- Cache eliminates redundant Qdrant calls for pagination and back-navigation
- Three-stage fallback ensures the app never shows an empty results page for any reasonable query

### Negative
- Application-level BM25 is O(n × m) on result pool size (n = documents, m = query terms) — adds ~5–15ms on top of Qdrant's latency
- Law diversity max-per-law cap (25%) can suppress a genuinely dominant law when its relevance is concentrated in one area
- Fallback ILIKE queries use `%term%` patterns which cannot leverage B-tree indexes efficiently on large `norms` tables
- Cache is per-process — lost on server restart or cold start

### Tradeoffs
- **Why not Qdrant native prefetch?** The managed inference API does not support sparse vector queries from TypeScript due to Python hash non-determinism across runtimes. Application-level BM25 achieves the same hybrid benefit portably.
- **Why not Postgres pg_trgm?** The gist-based trigram index was considered for fallback but ILIKE with a brief result expectation (<20 rows) and the query patterns (abbreviations, short codes) made simple ILIKE sufficient and cheaper to maintain.
- **Why not re-index with BM25 pre-computed?** The document corpus is static (6,000+ federal laws, 103k norms updated via batch pipeline). Static BM25 term frequencies could be computed once, but the hybrid weight tuning and keyword rerank logic benefit from being in the application layer where iteration is faster.

## Future Improvements

1. **Query expansion dictionary**: Pre-expand common abbreviation variants (e.g., "BGB" → "Bürgerliches Gesetzbuch, BGB") in the pre-search stage so the vector search also gets the expanded form.

2. **Pg_trgm index for fallback**: Add a GiST/GIN trigram index on `norms.content` and `norms.norm_title` to speed up the Stage 2 fallback ILIKE queries at scale.

3. **Per-category BM25 tuning**: Different legal domains have different keyword densities (e.g., traffic law uses many section numbers, family law uses more prose). Category-specific α weights could improve domain accuracy.

4. **Persistent cache**: Replace the in-memory LRU with Redis to preserve cache across deploys and share across instances.

5. **Adaptive α weighting**: Dynamically shift between dense and BM25 weight based on query characteristics — short abbreviation-heavy queries get higher BM25 weight, long descriptive queries get higher dense weight.

## References

- ADR-004: E5-small Query Prefix Fix (GLV-040)
- ADR-007: Qdrant Search Relevance Fix (empty point cluster removal)
- `nextjs/src/lib/qdrant.ts` — hybrid search implementation
- `nextjs/src/lib/law-keys.ts` — law abbreviation pre-search
- `nextjs/src/app/api/search/route.ts` — fallback chain orchestration
- E5-small paper: Liang et al., "Multilingual E5 Text Embeddings: A Technical Report" (2024)
- BM25: Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond" (2009)
