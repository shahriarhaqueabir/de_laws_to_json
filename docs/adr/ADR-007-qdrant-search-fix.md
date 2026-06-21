# ADR-007: Qdrant Search Relevance Fix

## Status

✅ Accepted — Applied 2026-06-21

## Context

Search queries in the German Law Vault app returned completely irrelevant results —
for example, "accident on road" returned `UrhG § 140` (copyright law) and
`KunstUrhG § 39` (art copyright) instead of expected traffic/civil liability laws
like `StVG` (Road Traffic Act) or `StVO` (Traffic Regulations).

The search pipeline uses Qdrant Cloud with `intfloat/multilingual-e5-small` managed
inference. Query-side code was correctly using `query: ` prefix (see GLV-040/ADR-004).

## Root Cause

The Qdrant `german_norms` collection contained 107,237 points. Of these, 3,651 points
(3.4%) had `content` field set to `"-"` (hyphen placeholder) instead of actual
norm text. These empty-content points all shared **identical vectors**:

```
cosine similarity between any two empty-content points = 1.0
first 3 values: [0.08555309, -0.022695737, -0.029684454]
```

This created an artificial 3,651-point dense cluster at the same vector position.
Every search query (regardless of content) returned this cluster as the nearest
neighbor, because:

1. All `"-"` points were embedded from text `"passage: -"` — identical string
2. All produced the same 384-dimensional vector
3. HNSW indexing treated them as a single high-density region
4. Query vectors always landed closest to this cluster first

The properly-indexed 96.6% of points (96,579 with real norm text) never surfaced
because the empty cluster dominated the top-k results.

## Decision

**Delete all points with empty content** directly from the Qdrant collection.

We did NOT re-index because the majority of points (96.6%) already contained
correct content and proper embeddings. Only the 3.4% of points that were indexed
from empty/placeholder content needed removal.

## Implementation

1. **Script**: `scripts/analyze_qdrant.py` — scanned all 107k points counting
   empty vs non-empty, verified identical vectors, confirmed the hypothesis.

2. **Script**: `scripts/fix_qdrant_search.py` — scrolled all points, collected
   3,651 empty-content IDs, deleted them in batches of 1,000.

3. **Verification**:
   - Before: "Unfall auf der Straße" → top results all empty UrhG/JGG/KonsG
   - After: "Unfall auf der Straße" → StVO § 34 (Unfall), StGB § 142
     (Hit and run), VVG § 178 (Insurance), KfzPflVV (Vehicle liability)
   - All 302 tests pass, TypeScript 0 errors
   - Diagnostics endpoint returns both Supabase + Qdrant as OK

## Results

| Metric | Before | After |
|--------|--------|-------|
| Points | 107,237 | 103,586 |
| Empty points | 3,651 (3.4%) | 0 |
| German search | Random (UrhG) | Relevant (StVO, StGB, VVG) |
| English search | Random | Partially relevant (cross-lingual limitation) |

## Consequences

### Positive
- German-language semantic search now returns correct legal results
- Guidance engine can now find relevant norms for case analysis
- No data loss — empty points had no useful content
- Fix was immediate without re-indexing 107k points (hours of compute)

### Negative
- Some laws (e.g., HBegleitG 84% empty, RVO 84% empty) lost most of their
  points. These are mostly administrative "Änderungsgesetze" (amending laws)
  or repealed sections. Not a practical loss for legal guidance use cases.
- English queries are still less precise than German — expected with E5-small
  and German-only content. Fix: add query translation in future.

## Future Improvements

1. **Query translation**: Detect non-German user queries and translate to German
   before sending to Qdrant. This would improve English query relevance.

2. **Periodic audit**: Add a monitoring script that periodically checks Qdrant
   for points with empty content and alerts if new empty points appear.

3. **Re-index from source**: For the few laws where most points were empty,
   consider downloading from gesetze-im-internet.de and re-indexing those specific
   laws with proper content.

## References

- ADR-004: E5-small Query Prefix Fix (GLV-040)
- `scripts/analyze_qdrant.py` — analysis script
- `scripts/fix_qdrant_search.py` — fix script
