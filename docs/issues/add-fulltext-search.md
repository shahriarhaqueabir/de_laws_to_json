# Issue: Add Full-Text Search Migration (tsvector on laws table)

**Priority:** Medium
**Area:** Search, Database
**Labels:** enhancement, database, search

## Description
Add a PostgreSQL full-text search vector column to the `laws` table so we can use Supabase `.textSearch()` as a co-primary search path alongside Qdrant. This would provide keyword-precise search for law names and abbreviations without relying on embedding quality.

## Implementation
1. Create migration 00010 to add a generated `tsvector` column:
```sql
ALTER TABLE public.laws ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('german', coalesce(key, '') || ' ' ||
                         coalesce(title, '') || ' ' ||
                         coalesce(alt_title, ''))
  ) STORED;

CREATE INDEX idx_laws_search_vector ON public.laws USING GIN (search_vector);
```

2. Update `search/route.ts` to call `.textSearch('search_vector', query)` as a co-primary path
3. Merge results with Qdrant, prefer full-text matches for exact law names

## Benefits
- Exact law name matching without relying on embedding quality
- German stemmer (`to_tsvector('german', ...)`) handles German compound words
- No re-indexing of Qdrant collection needed
- Fast GIN index lookups

## Migration Risk
- Reversible: `ALTER TABLE ... DROP COLUMN search_vector`
- Column is `GENERATED ... STORED`, so existing rows auto-populate
- Index creation may take a few seconds on 6K rows

## Acceptance Criteria
- [ ] Migration applies cleanly
- [ ] Search for "Straßenverkehrsgesetz" finds StVG via full-text
- [ ] Search for "car accident" uses combined Qdrant + full-text
- [ ] Results merged and deduplicated correctly
