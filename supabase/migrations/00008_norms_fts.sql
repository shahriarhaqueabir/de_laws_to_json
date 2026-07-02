-- Migration 00008: Create norms table with full-text search support
-- This enables fallback FTS when Qdrant is unavailable or returns
-- poor results. Uses pg_trgm for trigram-based fuzzy matching.

-- Enable pg_trgm extension
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Main norms table mirroring Qdrant payload schema
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

-- Indexes for lookups and filtering
CREATE INDEX IF NOT EXISTS idx_norms_law_key ON norms (law_key);
CREATE INDEX IF NOT EXISTS idx_norms_norm_id ON norms (norm_id);
CREATE INDEX IF NOT EXISTS idx_norms_category ON norms (category);

-- GIN trigram index for fuzzy German text search
CREATE INDEX IF NOT EXISTS idx_norms_content_trgm ON norms USING GIN (content gin_trgm_ops);

-- RLS: publicly readable, insert-only from server
ALTER TABLE norms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Norms are publicly readable" ON norms;
CREATE POLICY "Norms are publicly readable" ON norms FOR SELECT USING (true);
