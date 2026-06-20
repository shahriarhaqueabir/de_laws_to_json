-- Migration 00004: Capture cloud schema drift
-- Adds tables and RLS policies applied directly in Supabase Cloud
-- that were never captured in migration files.
--
-- Tables added: courts, profiles, legal_cases, case_documents,
--               case_hearings, case_parties
-- Columns added to norm_explanations: case_id, user_id
-- RLS: dropped old permissive policies, added user-owned + admin override

-- ── 1. Helper functions (idempotent) ───────────────────────────────────────

-- Used by profiles BEFORE UPDATE trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Syncs norm_explanations.user_id from legal_cases.user_id on case_id change
create or replace function public.sync_norm_explanations_user_id()
returns trigger
security definer
language plpgsql
as $$
begin
  if new.case_id is null then
    new.user_id := null;
  else
    select lc.user_id into new.user_id
    from public.legal_cases lc
    where lc.id = new.case_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_norm_explanations_user_id() from public, anon;

-- ── 2. New tables ──────────────────────────────────────────────────────────

-- Reference: German courthouses
create table if not exists public.courts (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  court_type  text not null check (court_type in (
                'amtsgericht', 'landgericht', 'oberlandesgericht',
                'bundesgerichtshof', 'verwaltungsgericht',
                'finanzgericht', 'arbeitsgericht', 'sozialgericht'
              )),
  city        text not null,
  state       text,
  address     text,
  phone       text,
  created_at  timestamptz default now()
);

-- User profiles with role-based access
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id),
  full_name   text not null,
  email       text,
  role        text not null default 'attorney'::text check (
                role in ('attorney', 'paralegal', 'judge', 'admin')
              ),
  bar_number  text,
  phone       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Legal cases (ownership chain target)
create table if not exists public.legal_cases (
  id            uuid primary key default gen_random_uuid(),
  case_number   text not null unique,
  title         text not null,
  description   text,
  status        text not null default 'draft'::text check (
                  status in ('draft', 'open', 'pending', 'closed')
                ),
  filed_date    date default current_date,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  court_id      uuid references public.courts (id),
  case_type     text check (
                  case_type in ('civil', 'criminal', 'administrative',
                                'family', 'labor', 'tax', 'social')
                ),
  priority      text default 'normal'::text check (
                  priority in ('low', 'normal', 'high', 'urgent')
                ),
  user_id       uuid references auth.users (id)
);

-- Case documents
create table if not exists public.case_documents (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references public.legal_cases (id),
  document_type   text not null check (
                    document_type in ('pleading', 'motion', 'evidence', 'judgment')
                  ),
  file_name       text not null,
  file_url        text not null,
  filed_by        text,
  filed_date      timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

-- Case hearings
create table if not exists public.case_hearings (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.legal_cases (id),
  hearing_date  date not null,
  court_room    text,
  judge_name    text,
  outcome       text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- Case parties (profiles linked to a case)
create table if not exists public.case_parties (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references public.legal_cases (id),
  profile_id    uuid not null references public.profiles (id),
  party_type    text not null check (
                  party_type in ('plaintiff', 'defendant',
                                 'plaintiff_attorney', 'defendant_attorney',
                                 'witness', 'judge')
                ),
  joined_date   date default current_date,
  notes         text,
  created_at    timestamptz default now()
);

-- ── 3. New columns on existing tables ─────────────────────────────────────

alter table public.norm_explanations
  add column if not exists case_id uuid
  references public.legal_cases (id);

alter table public.norm_explanations
  add column if not exists user_id uuid;

-- ── 4. Indexes ────────────────────────────────────────────────────────────

create index if not exists idx_legal_cases_court_id
  on public.legal_cases (court_id);
create index if not exists idx_legal_cases_user_id
  on public.legal_cases (user_id);
create index if not exists idx_case_documents_case_id
  on public.case_documents (case_id);
create index if not exists idx_case_hearings_case_id
  on public.case_hearings (case_id);
create index if not exists idx_case_parties_case_id
  on public.case_parties (case_id);
create index if not exists idx_case_parties_profile_id
  on public.case_parties (profile_id);
create index if not exists idx_profiles_user_id
  on public.profiles (user_id);
create index if not exists idx_norm_explanations_case_id
  on public.norm_explanations (case_id);

-- ── 5. Triggers ───────────────────────────────────────────────────────────

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

drop trigger if exists trg_sync_norm_explanations_user_id on public.norm_explanations;
create trigger trg_sync_norm_explanations_user_id
  before insert or update of case_id on public.norm_explanations
  for each row
  execute function public.sync_norm_explanations_user_id();

-- ── 6. RLS: Enable on new tables ──────────────────────────────────────────

alter table public.courts enable row level security;
alter table public.profiles enable row level security;
alter table public.legal_cases enable row level security;
alter table public.case_documents enable row level security;
alter table public.case_hearings enable row level security;
alter table public.case_parties enable row level security;
alter table public.norm_explanations enable row level security;

-- ── 7. RLS: Drop old policies replaced by granular ones ───────────────────

drop policy if exists "users own conversations" on public.conversations;
drop policy if exists "users own messages" on public.messages;
drop policy if exists "users own bookmarks" on public.bookmarks;
drop policy if exists "norm_explanations are public" on public.norm_explanations;
drop policy if exists "norm_explanations insert" on public.norm_explanations;

-- ── 8. RLS: New policies ──────────────────────────────────────────────────

-- Helper: admin override subquery used across policies
-- EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')

do $$
begin
  -- ── courts ──────────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'courts'
      and policyname = 'authenticated_users_can_read_courts'
  ) then
    create policy "authenticated_users_can_read_courts"
      on public.courts for select
      using (true);
  end if;

  -- ── profiles ────────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'authenticated_users_can_read_all_profiles'
  ) then
    create policy "authenticated_users_can_read_all_profiles"
      on public.profiles for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'users_can_update_own_profile'
  ) then
    create policy "users_can_update_own_profile"
      on public.profiles for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  -- ── legal_cases ─────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'legal_cases'
      and policyname = 'legal_cases: read own/admin'
  ) then
    create policy "legal_cases: read own/admin"
      on public.legal_cases for select
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'legal_cases'
      and policyname = 'legal_cases: insert own/admin'
  ) then
    create policy "legal_cases: insert own/admin"
      on public.legal_cases for insert
      with check (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'legal_cases'
      and policyname = 'legal_cases: update own/admin'
  ) then
    create policy "legal_cases: update own/admin"
      on public.legal_cases for update
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      )
      with check (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'legal_cases'
      and policyname = 'legal_cases: delete own/admin'
  ) then
    create policy "legal_cases: delete own/admin"
      on public.legal_cases for delete
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  -- ── conversations ───────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'conversations: read own/admin'
  ) then
    create policy "conversations: read own/admin"
      on public.conversations for select
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'conversations: insert own/admin'
  ) then
    create policy "conversations: insert own/admin"
      on public.conversations for insert
      with check (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'conversations: update own/admin'
  ) then
    create policy "conversations: update own/admin"
      on public.conversations for update
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      )
      with check (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations'
      and policyname = 'conversations: delete own/admin'
  ) then
    create policy "conversations: delete own/admin"
      on public.conversations for delete
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  -- ── messages ────────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages: read own/admin'
  ) then
    create policy "messages: read own/admin"
      on public.messages for select
      using (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages: insert own/admin'
  ) then
    create policy "messages: insert own/admin"
      on public.messages for insert
      with check (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages: update own/admin'
  ) then
    create policy "messages: update own/admin"
      on public.messages for update
      using (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      )
      with check (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages'
      and policyname = 'messages: delete own/admin'
  ) then
    create policy "messages: delete own/admin"
      on public.messages for delete
      using (
        exists (
          select 1 from public.conversations c
          where c.id = messages.conversation_id
            and (c.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  -- ── bookmarks ───────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookmarks'
      and policyname = 'bookmarks: read own/admin'
  ) then
    create policy "bookmarks: read own/admin"
      on public.bookmarks for select
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookmarks'
      and policyname = 'bookmarks: insert own/admin'
  ) then
    create policy "bookmarks: insert own/admin"
      on public.bookmarks for insert
      with check (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookmarks'
      and policyname = 'bookmarks: update own/admin'
  ) then
    create policy "bookmarks: update own/admin"
      on public.bookmarks for update
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      )
      with check (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookmarks'
      and policyname = 'bookmarks: delete own/admin'
  ) then
    create policy "bookmarks: delete own/admin"
      on public.bookmarks for delete
      using (
        user_id = auth.uid() or exists (
          select 1 from public.profiles p
          where p.user_id = auth.uid() and p.role = 'admin'
        )
      );
  end if;

  -- ── norm_explanations ───────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'norm_explanations'
      and policyname = 'norm_explanations: read own/admin'
  ) then
    create policy "norm_explanations: read own/admin"
      on public.norm_explanations for select
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = norm_explanations.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'norm_explanations'
      and policyname = 'norm_explanations: insert own/admin'
  ) then
    create policy "norm_explanations: insert own/admin"
      on public.norm_explanations for insert
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = norm_explanations.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'norm_explanations'
      and policyname = 'norm_explanations: update own/admin'
  ) then
    create policy "norm_explanations: update own/admin"
      on public.norm_explanations for update
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = norm_explanations.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      )
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = norm_explanations.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'norm_explanations'
      and policyname = 'norm_explanations: delete own/admin'
  ) then
    create policy "norm_explanations: delete own/admin"
      on public.norm_explanations for delete
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = norm_explanations.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  -- ── case_documents ──────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_documents'
      and policyname = 'case_documents: read own/admin'
  ) then
    create policy "case_documents: read own/admin"
      on public.case_documents for select
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_documents.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_documents'
      and policyname = 'case_documents: insert own/admin'
  ) then
    create policy "case_documents: insert own/admin"
      on public.case_documents for insert
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_documents.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_documents'
      and policyname = 'case_documents: update own/admin'
  ) then
    create policy "case_documents: update own/admin"
      on public.case_documents for update
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_documents.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      )
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_documents.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_documents'
      and policyname = 'case_documents: delete own/admin'
  ) then
    create policy "case_documents: delete own/admin"
      on public.case_documents for delete
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_documents.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  -- ── case_hearings ───────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_hearings'
      and policyname = 'case_hearings: read own/admin'
  ) then
    create policy "case_hearings: read own/admin"
      on public.case_hearings for select
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_hearings.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_hearings'
      and policyname = 'case_hearings: insert own/admin'
  ) then
    create policy "case_hearings: insert own/admin"
      on public.case_hearings for insert
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_hearings.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_hearings'
      and policyname = 'case_hearings: update own/admin'
  ) then
    create policy "case_hearings: update own/admin"
      on public.case_hearings for update
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_hearings.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      )
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_hearings.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_hearings'
      and policyname = 'case_hearings: delete own/admin'
  ) then
    create policy "case_hearings: delete own/admin"
      on public.case_hearings for delete
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_hearings.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  -- ── case_parties ────────────────────────────────────────────────
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_parties'
      and policyname = 'case_parties: read own/admin'
  ) then
    create policy "case_parties: read own/admin"
      on public.case_parties for select
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_parties.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_parties'
      and policyname = 'case_parties: insert own/admin'
  ) then
    create policy "case_parties: insert own/admin"
      on public.case_parties for insert
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_parties.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_parties'
      and policyname = 'case_parties: update own/admin'
  ) then
    create policy "case_parties: update own/admin"
      on public.case_parties for update
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_parties.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      )
      with check (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_parties.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'case_parties'
      and policyname = 'case_parties: delete own/admin'
  ) then
    create policy "case_parties: delete own/admin"
      on public.case_parties for delete
      using (
        exists (
          select 1 from public.legal_cases lc
          where lc.id = case_parties.case_id
            and (lc.user_id = auth.uid() or exists (
              select 1 from public.profiles p
              where p.user_id = auth.uid() and p.role = 'admin'
            ))
        )
      );
  end if;
end
$$;
