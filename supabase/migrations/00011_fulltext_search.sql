-- Migration 00011: Add full-text search vector to laws table
-- Enables PostgreSQL full-text search as co-primary with Qdrant.
-- Uses 'german' text search configuration for proper German stemming
-- and compound word handling.

alter table public.laws add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('german', coalesce(key, '') || ' ' ||
                         coalesce(title, '') || ' ' ||
                         coalesce(alt_title, ''))
  ) stored;

create index if not exists idx_laws_search_vector
  on public.laws using gin (search_vector);
