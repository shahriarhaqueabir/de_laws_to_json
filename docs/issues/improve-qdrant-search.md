# Issue: Improve Qdrant Search Relevance — Re-index with Better Embedding Model

**Priority:** High
**Area:** Search
**Labels:** enhancement, search, qdrant

## Description
E5-small (384d) embeddings are fundamentally inadequate for 100K+ fine-grained legal norms. Short queries like "i got into a car accident" return procedurally unrelated laws (ÖlmeldV, BKOrgErl) instead of core traffic laws (StVG, StVO).

## Root Cause
The 384-dimensional embedding space is too crowded for 100K+ legal norm paragraphs. Within a single category (e.g., traffic), the model cannot reliably distinguish substantive norms (StVG liability provisions) from procedural or unrelated norms (ÖlmeldV oil reporting).

## Solutions (ranked)

### Option A: Re-index with 768d+ model (Recommended)
- Create a new Qdrant collection with `intfloat/multilingual-e5-base` (768d) or `intfloat/multilingual-e5-large` (1024d)
- Re-embed all 103K+ norm points
- Expected: significantly better differentiation within categories

### Option B: Hybrid BM25 + Vector Search
- Add a `tsvector` column to Supabase `laws` table
- Use PostgreSQL full-text search as co-primary with Qdrant
- Merge and rerank results
- Advantage: No re-indexing needed

### Option C: Keyword-weighted reranking improvements
- Already implemented: law abbreviation pre-search, keyword reranking, diversity boost
- Marginal gains remain but won't fully solve the problem

## Acceptance Criteria
- [ ] "car accident" returns StVG/StVO as top results
- [ ] "kündigung" returns KSchG as top result
- [ ] Short query precision at top-5 is >80%
- [ ] Re-indexing completes without errors

## Current Mitigations (already deployed)
- Law abbreviation pre-search (before Qdrant)
- Keyword-based reranking in qdrant.ts
- Law diversity boost (prefer laws with multiple norm hits)
- Two-pass search (with/without category filter)
- Supabase ilike fallback
