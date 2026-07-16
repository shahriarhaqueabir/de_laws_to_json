-- Migration 00016: Add UNIQUE constraint to remediation_playbooks
--
-- The JS seed script (seed_data.js:492) calls .upsert(playbooks, { onConflict: "issue_type" })
-- but issue_type had no unique constraint, causing the upsert to silently fail deduplication.
-- This migration adds the constraint and updates the SQL seed to use ON CONFLICT.
--
-- See R-10 F-01

-- ═══════════════════════════════════════════════════════════════
-- 1. Remove any existing duplicate rows first
-- ═══════════════════════════════════════════════════════════════

delete from public.remediation_playbooks
  where ctid not in (
    select min(ctid)
    from public.remediation_playbooks
    group by category, issue_type
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. Add unique constraint
-- ═══════════════════════════════════════════════════════════════

alter table public.remediation_playbooks
  add constraint remediation_playbooks_category_issue_type_key
  unique (category, issue_type);
