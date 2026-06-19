-- Migration 00003: Hybrid Translation Support
-- Adds English metadata columns to laws and identifies official
-- translations in the explanations cache.

-- 1. Ensure norm_explanations table exists (Self-healing from missing 00002)
CREATE TABLE IF NOT EXISTS public.norm_explanations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  norm_id     TEXT NOT NULL,
  law_key     TEXT NOT NULL,
  lang        TEXT NOT NULL DEFAULT 'en',
  translation TEXT NOT NULL DEFAULT '',
  summary     TEXT NOT NULL DEFAULT '',
  implications TEXT NOT NULL DEFAULT '',
  next_steps  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (norm_id, lang)
);

-- 2. Extend Laws table
ALTER TABLE public.laws
ADD COLUMN IF NOT EXISTS title_en TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS official_translation_url TEXT;

-- 3. Add is_official flag to norm_explanations
-- This allows us to distinguish between AI-generated and Verified translations.
ALTER TABLE public.norm_explanations
ADD COLUMN IF NOT EXISTS is_official BOOLEAN DEFAULT false;

-- 4. Enable RLS and Policies if they don't exist
ALTER TABLE public.norm_explanations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'norm_explanations' AND policyname = 'norm_explanations are public'
  ) THEN
    CREATE POLICY "norm_explanations are public" ON public.norm_explanations FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'norm_explanations' AND policyname = 'norm_explanations insert'
  ) THEN
    CREATE POLICY "norm_explanations insert" ON public.norm_explanations FOR INSERT WITH CHECK (true);
  END IF;
END
$$;
