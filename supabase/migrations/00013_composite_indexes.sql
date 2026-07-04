-- Migration 00013: Composite indexes for guidance engine hot paths
--
-- Replaces individual indexes on case_files(user_id) and
-- bookmark_folders(user_id) with composite (user_id, category) indexes
-- that cover both user-only queries (via B-tree prefix) and
-- combined user+category lookups without an extra index scan.
--
-- The individual idx_case_files_user_id is redundant once the
-- composite exists — PostgreSQL can use the composite's leading
-- column for user_id-only filters efficiently.

-- ═══════════════════════════════════════════════════════════════
-- 1. case_files(user_id, category)
--    Hot path: guidance session listing (user_id filter) and
--    future user_id + category drill-down.
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'case_files'
  ) THEN
    -- Drop the now-redundant individual index
    DROP INDEX IF EXISTS idx_case_files_user_id;

    -- Create composite (production-safe: IF NOT EXISTS)
    CREATE INDEX IF NOT EXISTS idx_case_files_user_id_category
      ON public.case_files (user_id, category);
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. bookmark_folders(user_id, category)
--    Hot path: folder listing filtered by user, future category
--    drill-down (e.g., "show only labor folders").
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bookmark_folders'
  ) THEN
    -- Drop the now-redundant individual index
    DROP INDEX IF EXISTS idx_bookmark_folders_user_id;

    -- Create composite (production-safe: IF NOT EXISTS)
    CREATE INDEX IF NOT EXISTS idx_bookmark_folders_user_id_category
      ON public.bookmark_folders (user_id, category);
  END IF;
END
$$;
