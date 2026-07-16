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

-- Soft FK: norms.law_key → laws.key
-- Cleans orphan rows first, then adds constraint with ON DELETE SET NULL
-- to preserve norms even if a law key is removed.
DELETE FROM public.norms
WHERE law_key IS NOT NULL
  AND law_key NOT IN (SELECT key FROM public.laws);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_norms_law_key'
  ) THEN
    ALTER TABLE public.norms
      ADD CONSTRAINT fk_norms_law_key
      FOREIGN KEY (law_key) REFERENCES public.laws(key)
      ON DELETE SET NULL;
  END IF;
END
$$;
