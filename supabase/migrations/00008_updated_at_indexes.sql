-- Migration 00008: Re-create set_updated_at(), add missing triggers and indexes
--
-- Migration 00007 dropped the set_updated_at() function. This migration
-- restores it and adds BEFORE UPDATE triggers to all tables that have
-- an updated_at column but no trigger to maintain it automatically.
--
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
-- ═══════════════════════════════════════════════════════════════

-- ── conversations ──
DROP TRIGGER IF EXISTS trg_conversations_updated_at ON public.conversations;
CREATE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── case_files ──
DROP TRIGGER IF EXISTS trg_case_files_updated_at ON public.case_files;
CREATE TRIGGER trg_case_files_updated_at
  BEFORE UPDATE ON public.case_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── user_api_keys ──
DROP TRIGGER IF EXISTS trg_user_api_keys_updated_at ON public.user_api_keys;
CREATE TRIGGER trg_user_api_keys_updated_at
  BEFORE UPDATE ON public.user_api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── bookmark_folders ──
DROP TRIGGER IF EXISTS trg_bookmark_folders_updated_at ON public.bookmark_folders;
CREATE TRIGGER trg_bookmark_folders_updated_at
  BEFORE UPDATE ON public.bookmark_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ═══════════════════════════════════════════════════════════════
-- 3. Missing hot-path indexes
--    Guidance engine queries filter by user_id and category.
--    Remediation playbook lookups filter by category.
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_case_files_user_id
  ON public.case_files (user_id);

CREATE INDEX IF NOT EXISTS idx_case_files_category
  ON public.case_files (category);

CREATE INDEX IF NOT EXISTS idx_remediation_playbooks_category
  ON public.remediation_playbooks (category);
