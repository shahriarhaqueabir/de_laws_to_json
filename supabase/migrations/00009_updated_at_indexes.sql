-- Migration 00008: Re-create set_updated_at(), add missing triggers and indexes
--
-- Migration 00007 dropped the set_updated_at() function. This migration
-- restores it and adds BEFORE UPDATE triggers to all tables that have
-- an updated_at column but no trigger to maintain it automatically.
--
-- Uses existence checks so it won't fail if tables/columns are missing.
-- Also adds missing hot-path indexes on case_files and remediation_playbooks
-- to improve guidance engine queries.

-- ═══════════════════════════════════════════════════════════════
-- 1. Re-create set_updated_at() helper function
--    Dropped by migration 00007. Used by BEFORE UPDATE triggers.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. BEFORE UPDATE triggers for tables with updated_at
--    Each trigger auto-sets updated_at = now() on row modification.
--    Guarded with existence checks to prevent failures when
--    tables or columns are missing.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- ── conversations ──
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversations'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
    CREATE TRIGGER trg_conversations_updated_at
      BEFORE UPDATE ON public.conversations
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ── case_files ──
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'case_files'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_files' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_case_files_updated_at ON public.case_files;
    CREATE TRIGGER trg_case_files_updated_at
      BEFORE UPDATE ON public.case_files
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ── user_api_keys ──
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_api_keys'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_api_keys' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_user_api_keys_updated_at ON public.user_api_keys;
    CREATE TRIGGER trg_user_api_keys_updated_at
      BEFORE UPDATE ON public.user_api_keys
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ── bookmark_folders ──
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookmark_folders'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookmark_folders' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_bookmark_folders_updated_at ON public.bookmark_folders;
    CREATE TRIGGER trg_bookmark_folders_updated_at
      BEFORE UPDATE ON public.bookmark_folders
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;

  -- ── bookmarks ──
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookmarks'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookmarks' AND column_name = 'updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS trg_bookmarks_updated_at ON public.bookmarks;
    CREATE TRIGGER trg_bookmarks_updated_at
      BEFORE UPDATE ON public.bookmarks
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Missing hot-path indexes
--    Guidance engine queries filter by user_id and category.
--    Remediation playbook lookups filter by category.
--    Guarded with existence checks to prevent failures.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'case_files'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_files' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_case_files_user_id
      ON public.case_files (user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'case_files'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'case_files' AND column_name = 'category'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_case_files_category
      ON public.case_files (category);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'remediation_playbooks'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'remediation_playbooks' AND column_name = 'category'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_category
      ON public.remediation_playbooks (category);
  END IF;
END
$$;
