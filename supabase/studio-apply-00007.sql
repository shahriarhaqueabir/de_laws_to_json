-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 00007: GUIDANCE FEATURE + BOOKMARK FOLDERS
-- ═══════════════════════════════════════════════════════════════════════════
--
-- HOW TO APPLY:
-- 1. Open the Supabase Studio SQL Editor
--    Dashboard → SQL Editor → New Query
-- 2. Paste ALL of the SQL below
-- 3. Click "Run" (or Ctrl+Enter)
-- 4. Verify: SELECT * FROM bookmark_folders LIMIT 1;
--           SELECT * FROM guidance_paths LIMIT 1;
--
-- This migration:
-- 1. Creates bookmark_folders (uniform AI-guidance properties)
-- 2. Links bookmarks → folders via folder_id FK
-- 3. Creates guidance_paths for AI-generated outcomes
-- 4. Drops migration 00005 tables (replaced by folder system)
-- 5. Drops orphan columns/triggers from norm_explanations
-- 6. Adds missing FK: norm_explanations.law_key → laws.key
-- 7. Adds missing hot-path indexes
-- 8. Restores RLS policies broken by migration 00005

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Bookmark folders with uniform AI-guidance properties
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bookmark_folders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'other',

  -- Uniform properties — each field feeds the AI guidance engine
  incident_date   DATE,                                    -- When did the situation occur?
  dispute_value   NUMERIC(12,2) NOT NULL DEFAULT 0.00,     -- Streitwert (EUR)
  status          TEXT NOT NULL DEFAULT 'pre_action'
                  CHECK (status IN ('pre_action', 'consulting', 'filed', 'in_progress', 'resolved')),
  opposing_party  TEXT NOT NULL DEFAULT '',                 -- Other side (employer, landlord, etc.)
  deadline_date   DATE,                                    -- Critical statutory deadline
  court_name      TEXT NOT NULL DEFAULT '',                 -- Court if proceedings started
  case_number     TEXT NOT NULL DEFAULT '',                 -- Aktenzeichen
  notes           TEXT NOT NULL DEFAULT '',                 -- Free-text context for AI

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Link bookmarks → folders
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS folder_id UUID
  REFERENCES public.bookmark_folders(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Guidance paths (AI-generated outcome paths)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.guidance_paths (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_file_id        UUID NOT NULL REFERENCES public.case_files(id) ON DELETE CASCADE,
  path_number         SMALLINT NOT NULL CHECK (path_number BETWEEN 1 AND 5),
  title               TEXT NOT NULL,
  summary             TEXT NOT NULL,
  detailed_analysis   TEXT NOT NULL,
  laws_cited          JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level          TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  cost_estimate       NUMERIC(12,2),
  recommended_actions TEXT NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Cleanup: drop migration 00005 tables
--    These are replaced by the user-driven bookmark folder system.
--    Users track court info, case numbers, etc. via folder properties.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.case_parties CASCADE;
DROP TABLE IF EXISTS public.case_hearings CASCADE;
DROP TABLE IF EXISTS public.case_documents CASCADE;
DROP TABLE IF EXISTS public.legal_cases CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.courts CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Cleanup: orphan columns + triggers on norm_explanations
--    case_id pointed to legal_cases (now dropped).
--    user_id was synced via trigger from legal_cases.
--    Both are unused in the guidance flow.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.norm_explanations DROP COLUMN IF EXISTS case_id;
ALTER TABLE public.norm_explanations DROP COLUMN IF EXISTS user_id;

DROP TRIGGER IF EXISTS trg_sync_norm_explanations_user_id ON public.norm_explanations;
DROP FUNCTION IF EXISTS public.sync_norm_explanations_user_id;
DROP FUNCTION IF EXISTS public.set_updated_at;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Missing FK: norm_explanations.law_key → laws.key
--    Clean orphan rows first, then add constraint.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM public.norm_explanations
WHERE law_key NOT IN (SELECT key FROM public.laws);

ALTER TABLE public.norm_explanations
  ADD CONSTRAINT IF NOT EXISTS fk_norm_explanations_law_key
  FOREIGN KEY (law_key) REFERENCES public.laws(key) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Missing hot-path indexes
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id
  ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder_id
  ON public.bookmarks(folder_id);
CREATE INDEX IF NOT EXISTS idx_bookmark_folders_user_id
  ON public.bookmark_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_guidance_paths_case_file_id
  ON public.guidance_paths(case_file_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. RLS: new tables
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bookmark_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guidance_paths ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bookmark_folders'
      AND policyname = 'users own folders'
  ) THEN
    CREATE POLICY "users own folders"
      ON public.bookmark_folders FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'guidance_paths'
      AND policyname = 'users own guidance paths'
  ) THEN
    CREATE POLICY "users own guidance paths"
      ON public.guidance_paths FOR ALL
      USING (
        case_file_id IN (SELECT id FROM public.case_files WHERE user_id = auth.uid())
      )
      WITH CHECK (
        case_file_id IN (SELECT id FROM public.case_files WHERE user_id = auth.uid())
      );
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. RLS: restore original permissive policies (broken by mig 00005)
--    Migration 00005 replaced user-owned policies with admin-role-dependent ones.
--    Since no users have profiles entries, the admin override is dead code.
--    Restore the originals from migration 00001.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── conversations ──
DROP POLICY IF EXISTS "conversations: read own/admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations: insert own/admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations: update own/admin" ON public.conversations;
DROP POLICY IF EXISTS "conversations: delete own/admin" ON public.conversations;

CREATE POLICY "users own conversations"
  ON public.conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── messages ──
DROP POLICY IF EXISTS "messages: read own/admin" ON public.messages;
DROP POLICY IF EXISTS "messages: insert own/admin" ON public.messages;
DROP POLICY IF EXISTS "messages: update own/admin" ON public.messages;
DROP POLICY IF EXISTS "messages: delete own/admin" ON public.messages;

CREATE POLICY "users own messages"
  ON public.messages FOR ALL
  USING (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
  )
  WITH CHECK (
    conversation_id IN (SELECT id FROM public.conversations WHERE user_id = auth.uid())
  );

-- ── bookmarks ──
DROP POLICY IF EXISTS "bookmarks: read own/admin" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks: insert own/admin" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks: update own/admin" ON public.bookmarks;
DROP POLICY IF EXISTS "bookmarks: delete own/admin" ON public.bookmarks;

CREATE POLICY "users own bookmarks"
  ON public.bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── norm_explanations ──
DROP POLICY IF EXISTS "norm_explanations: read own/admin" ON public.norm_explanations;
DROP POLICY IF EXISTS "norm_explanations: insert own/admin" ON public.norm_explanations;
DROP POLICY IF EXISTS "norm_explanations: update own/admin" ON public.norm_explanations;
DROP POLICY IF EXISTS "norm_explanations: delete own/admin" ON public.norm_explanations;

CREATE POLICY "norm_explanations are public"
  ON public.norm_explanations FOR SELECT
  USING (true);

CREATE POLICY "norm_explanations insert"
  ON public.norm_explanations FOR INSERT
  WITH CHECK (true);
