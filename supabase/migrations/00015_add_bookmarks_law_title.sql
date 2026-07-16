-- Migration 00015: Add law_title to bookmarks table
--
-- Bookmarks v2 stores law_title in localStorage but the Supabase table
-- never stored it. The sync code was mapping r.note (user's snippet) to
-- law_title on pull (GLV-050 / R-06 F-01), which silently corrupted
-- bookmark titles for signed-in users.
--
-- This migration adds the column, backfills existing rows with law_key
-- as a fallback title, and updates the sync code to use the actual title.

-- ═══════════════════════════════════════════════════════════════
-- 1. Add law_title column
-- ═══════════════════════════════════════════════════════════════

alter table public.bookmarks
  add column if not exists law_title text not null default '';

-- ═══════════════════════════════════════════════════════════════
-- 2. Backfill existing rows with law_key as fallback title
--    Only affects rows where law_title is empty (all existing rows).
--    Joins against the laws table to get the actual title where possible.
-- ═══════════════════════════════════════════════════════════════

update public.bookmarks b
  set law_title = coalesce(
    (select l.title from public.laws l where l.key = b.law_key),
    b.law_key
  )
  where b.law_title = '';
