-- Migration 00014: Strip trailing whitespace from law keys
--
-- Root cause: Some law keys were imported with trailing spaces (e.g., "NMV "
-- instead of "NMV", "AufenthG " instead of "AufenthG"). This caused law detail
-- pages and search to silently fail — .eq("key", "NMV") wouldn't match "NMV ".
--
-- Strategy:
--   1. Find conflicting rows first (two keys that collapse to the same key
--      after stripping). These need FK updates before deletion.
--   2. Update dependent tables (bookmarks) to use the trimmed key.
--   3. Clean up the laws table.

-- ═══════════════════════════════════════════════════════════════
-- 1. Check for conflicts
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  conflict_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO conflict_count FROM (
    SELECT trim("key") as clean_key
    FROM public.laws
    WHERE "key" != trim("key")
    AND trim("key") IN (SELECT "key" FROM public.laws WHERE "key" = trim("key"))
  ) conflicts;

  IF conflict_count > 0 THEN
    RAISE NOTICE 'Found % law key conflicts after trimming — manual resolution needed', conflict_count;
  ELSE
    RAISE NOTICE 'No law key conflicts — safe to update';
  END IF;
END
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Update bookmarks that reference trailing-space keys
-- ═══════════════════════════════════════════════════════════════

UPDATE public.bookmarks b
SET law_key = trim(b.law_key)
WHERE b.law_key != trim(b.law_key);

-- ═══════════════════════════════════════════════════════════════
-- 3. Strip trailing spaces from law keys
-- ═══════════════════════════════════════════════════════════════

UPDATE public.laws
SET "key" = trim("key")
WHERE "key" != trim("key");
