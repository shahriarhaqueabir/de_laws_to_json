-- Migration 00005: Consolidated squash (replaces 00005–00011)
--
-- This single migration consolidates all KEPT elements from migrations
-- 00006 through 00011, excluding dead code from 00005 (courts, profiles,
-- legal_cases, case_documents, case_hearings, case_parties, admin-override
-- RLS policies, orphan norm_explanations columns, sync function).
--
-- Uses IF NOT EXISTS / CREATE OR REPLACE throughout for idempotency.

-- ═══════════════════════════════════════════════════════════════
-- 1. Helper function: set_updated_at()
--    Used by BEFORE UPDATE triggers on tables with updated_at.
--    Source: 00008_updated_at_indexes (CREATE OR REPLACE)
-- ═══════════════════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Extensions
--    pg_trgm enables trigram-based fuzzy text search on norms table.
--    Source: 00008_norms_fts
-- ═══════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;

-- ═══════════════════════════════════════════════════════════════
-- 3. User API keys table
--    Server-side encrypted key storage (AES-256-GCM).
--    Source: 00006 (kept as-is)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.user_api_keys (
  user_id uuid primary key references auth.users (id) on delete cascade,
  encrypted_key text not null,
  provider text not null default 'openai' check (provider in ('openai', 'anthropic', 'openai-compatible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_api_keys enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_api_keys'
      and policyname = 'users own api key'
  ) then
    create policy "users own api key"
      on public.user_api_keys
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. Bookmark folders with uniform AI-guidance properties
--    Each folder tracks case metadata that feeds the guidance engine.
--    Source: 00007 §1 (kept) + 00007 §8 (RLS)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.bookmark_folders (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  description     text not null default '',
  category        text not null default 'other',

  -- Uniform AI-guidance properties
  incident_date   date,                                    -- when did the situation occur?
  dispute_value   numeric(12,2) not null default 0.00,     -- streitwert (eur)
  status          text not null default 'pre_action'
                  check (status in ('pre_action', 'consulting', 'filed', 'in_progress', 'resolved')),
  opposing_party  text not null default '',                 -- other side (employer, landlord, etc.)
  deadline_date   date,                                    -- critical statutory deadline
  court_name      text not null default '',                 -- court if proceedings started
  case_number     text not null default '',                 -- aktenzeichen
  notes           text not null default '',                 -- free-text context for ai

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.bookmark_folders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookmark_folders'
      and policyname = 'users own folders'
  ) then
    create policy "users own folders"
      on public.bookmark_folders for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. Link bookmarks → folders
--    Source: 00007 §2
-- ═══════════════════════════════════════════════════════════════

alter table public.bookmarks
  add column if not exists folder_id uuid
  references public.bookmark_folders(id) on delete set null;

-- ═══════════════════════════════════════════════════════════════
-- 6. Guidance paths table
--    Stores AI-generated outcome paths (3-5 per case_file).
--    Source: 00007 §3 (kept) + 00007 §8 (RLS)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.guidance_paths (
  id                  uuid primary key default gen_random_uuid(),
  case_file_id        uuid not null references public.case_files(id) on delete cascade,
  path_number         smallint not null check (path_number between 1 and 5),
  title               text not null,
  summary             text not null,
  detailed_analysis   text not null,
  laws_cited          jsonb not null default '[]'::jsonb,
  risk_level          text not null check (risk_level in ('low', 'medium', 'high')),
  cost_estimate       numeric(12,2),
  recommended_actions text not null,
  created_at          timestamptz not null default now()
);

alter table public.guidance_paths enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'guidance_paths'
      and policyname = 'users own guidance paths'
  ) then
    create policy "users own guidance paths"
      on public.guidance_paths for all
      using (
        case_file_id in (select id from public.case_files where user_id = auth.uid())
      )
      with check (
        case_file_id in (select id from public.case_files where user_id = auth.uid())
      );
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════════════
-- 7. FK: norm_explanations.law_key → laws.key
--    Clean orphan rows first, then add constraint.
--    Source: 00007 §6
-- ═══════════════════════════════════════════════════════════════

delete from public.norm_explanations
where law_key is not null
  and law_key not in (select key from public.laws);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_norm_explanations_law_key'
  ) then
    alter table public.norm_explanations
      add constraint fk_norm_explanations_law_key
      foreign key (law_key) references public.laws(key) on delete cascade;
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════════════
-- 8. Norms table with full-text search support
--    Fallback FTS when Qdrant is unavailable.
--    Uses pg_trgm for trigram-based fuzzy matching.
--    Source: 00008_norms_fts
-- ═══════════════════════════════════════════════════════════════

create table if not exists norms (
  id          bigint generated always as identity primary key,
  law_key     text not null,
  law_title   text,
  category    text default 'other',
  norm_id     text not null,
  norm_title  text,
  content     text,
  created_at  timestamptz default now()
);

create index if not exists idx_norms_law_key on norms (law_key);
create index if not exists idx_norms_norm_id on norms (norm_id);
create index if not exists idx_norms_category on norms (category);

-- GIN trigram index for fuzzy German text search
create index if not exists idx_norms_content_trgm on norms using gin (content gin_trgm_ops);

alter table norms enable row level security;

drop policy if exists "Norms are publicly readable" on norms;
create policy "Norms are publicly readable" on norms for select using (true);

-- ═══════════════════════════════════════════════════════════════
-- 9. Rate limits table + functions
--    Shared Postgres-backed rate limiting for serverless instances.
--    Uses ip_hash (SHA-256 truncated) instead of raw IP.
--    Source: 00009
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.rate_limits (
  id bigserial primary key,
  ip_hash text not null,
  endpoint text not null,
  count integer not null default 1,
  window_start timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint per ip + endpoint + window (enables upsert)
create unique index if not exists idx_rate_limits_window
  on public.rate_limits (ip_hash, endpoint, window_start);

-- Index for fast cleanup queries
create index if not exists idx_rate_limits_window_start
  on public.rate_limits (window_start);

-- Auto-update updated_at trigger
drop trigger if exists trg_rate_limits_updated_at on public.rate_limits;
create trigger trg_rate_limits_updated_at
  before update on public.rate_limits
  for each row
  execute function public.set_updated_at();

-- RLS: no public access (server-side only via service_role)
alter table public.rate_limits enable row level security;

drop policy if exists "rate_limits_no_anon_select" on public.rate_limits;
create policy "rate_limits_no_anon_select" on public.rate_limits
  for select using (false);

drop policy if exists "rate_limits_no_anon_insert" on public.rate_limits;
create policy "rate_limits_no_anon_insert" on public.rate_limits
  for insert with check (false);

drop policy if exists "rate_limits_no_anon_update" on public.rate_limits;
create policy "rate_limits_no_anon_update" on public.rate_limits
  for update using (false);

drop policy if exists "rate_limits_no_anon_delete" on public.rate_limits;
create policy "rate_limits_no_anon_delete" on public.rate_limits
  for delete using (false);

-- Cleanup function: delete expired windows
create or replace function public.cleanup_rate_limits(window_minutes integer default 5)
returns integer
language plpgsql
as $$
declare
  deleted_count integer;
begin
  delete from public.rate_limits
  where window_start < now() - (window_minutes || ' minutes')::interval;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- SECURITY DEFINER function for rate limit checks (bypasses RLS)
create or replace function public.check_rate_limit(
  p_ip_hash text,
  p_endpoint text,
  p_max_requests integer default 10,
  p_window_ms integer default 60000
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
  v_now timestamptz := now();
  v_reset_at timestamptz;
  result jsonb;
begin
  -- Calculate current window start
  v_window_start := date_trunc('milliseconds', v_now) - (p_window_ms || ' milliseconds')::interval;

  -- Try to insert a new row (first request in window)
  insert into public.rate_limits (ip_hash, endpoint, count, window_start)
  values (p_ip_hash, p_endpoint, 1, v_window_start)
  on conflict (ip_hash, endpoint, window_start)
  do update set count = public.rate_limits.count + 1
  returning public.rate_limits.count, public.rate_limits.window_start
  into v_count, v_reset_at;

  -- Calculate reset time
  v_reset_at := v_reset_at + (p_window_ms || ' milliseconds')::interval;

  if v_count > p_max_requests then
    result := jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', extract(epoch from v_reset_at)
    );
  else
    result := jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - v_count,
      'reset_at', extract(epoch from v_reset_at)
    );
  end if;

  return result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 10. BEFORE UPDATE triggers for tables with updated_at
--     Each trigger auto-sets updated_at = now() on row modification.
--     Guarded with existence checks for safety.
--     Source: 00008_updated_at_indexes §2
-- ═══════════════════════════════════════════════════════════════

do $$
begin
  -- ── conversations ──
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'conversations'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'conversations' and column_name = 'updated_at'
  ) then
    drop trigger if exists trg_conversations_updated_at on public.conversations;
    create trigger trg_conversations_updated_at
      before update on public.conversations
      for each row
      execute function public.set_updated_at();
  end if;

  -- ── case_files ──
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'case_files'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'case_files' and column_name = 'updated_at'
  ) then
    drop trigger if exists trg_case_files_updated_at on public.case_files;
    create trigger trg_case_files_updated_at
      before update on public.case_files
      for each row
      execute function public.set_updated_at();
  end if;

  -- ── user_api_keys ──
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'user_api_keys'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_api_keys' and column_name = 'updated_at'
  ) then
    drop trigger if exists trg_user_api_keys_updated_at on public.user_api_keys;
    create trigger trg_user_api_keys_updated_at
      before update on public.user_api_keys
      for each row
      execute function public.set_updated_at();
  end if;

  -- ── bookmark_folders ──
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'bookmark_folders'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'bookmark_folders' and column_name = 'updated_at'
  ) then
    drop trigger if exists trg_bookmark_folders_updated_at on public.bookmark_folders;
    create trigger trg_bookmark_folders_updated_at
      before update on public.bookmark_folders
      for each row
      execute function public.set_updated_at();
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════════════
-- 11. Hot-path indexes
--     Improves query performance for guidance engine and chat.
--     Source: 00007 §7 + 00008_updated_at_indexes §3
-- ═══════════════════════════════════════════════════════════════

-- From 00007 (simple create index if not exists)
create index if not exists idx_conversations_user_id
  on public.conversations(user_id);
create index if not exists idx_messages_conversation_id
  on public.messages(conversation_id);
create index if not exists idx_bookmarks_user_id
  on public.bookmarks(user_id);
create index if not exists idx_bookmarks_folder_id
  on public.bookmarks(folder_id);
create index if not exists idx_bookmark_folders_user_id
  on public.bookmark_folders(user_id);
create index if not exists idx_guidance_paths_case_file_id
  on public.guidance_paths(case_file_id);

-- From 00008_updated_at_indexes (guarded with existence checks)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'case_files'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'case_files' and column_name = 'user_id'
  ) then
    create index if not exists idx_case_files_user_id
      on public.case_files (user_id);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'case_files'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'case_files' and column_name = 'category'
  ) then
    create index if not exists idx_case_files_category
      on public.case_files (category);
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'remediation_playbooks'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'remediation_playbooks' and column_name = 'category'
  ) then
    create index if not exists idx_remediation_playbooks_category
      on public.remediation_playbooks (category);
  end if;
end
$$;

-- ═══════════════════════════════════════════════════════════════
-- 12. Tighten norm_explanations RLS
--     Switch INSERT to service_role only; SELECT remains public.
--     Source: 00010
-- ═══════════════════════════════════════════════════════════════

revoke insert on public.norm_explanations from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 13. Full-text search vector on laws table
--     Enables PostgreSQL full-text search as co-primary with Qdrant.
--     Uses 'german' text search configuration for proper stemming.
--     Source: 00011
-- ═══════════════════════════════════════════════════════════════

alter table public.laws add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('german', coalesce(key, '') || ' ' ||
                         coalesce(title, '') || ' ' ||
                         coalesce(alt_title, ''))
  ) stored;

create index if not exists idx_laws_search_vector
  on public.laws using gin (search_vector);
