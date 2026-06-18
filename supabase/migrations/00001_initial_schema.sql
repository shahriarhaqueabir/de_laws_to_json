-- Supabase initial schema for German Law Vault.
-- Run once in the Supabase SQL editor or via psql.

create extension if not exists pgcrypto;

create table if not exists public.laws (
  "key" text primary key,
  title text not null default '',
  alt_title text not null default '',
  category text not null default 'other',
  authority text not null default '',
  status text not null default 'Active',
  jurisdiction text not null default 'Germany (Federal)',
  last_changed text not null default '',
  source text not null default '',
  total_norms integer not null default 0
);

create index if not exists idx_laws_category on public.laws (category);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  cited_laws jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  law_key text not null references public.laws ("key") on delete cascade,
  norm_id text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, law_key, norm_id)
);

alter table public.laws enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.bookmarks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'laws'
      and policyname = 'laws are public'
  ) then
    create policy "laws are public"
      on public.laws
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'conversations'
      and policyname = 'users own conversations'
  ) then
    create policy "users own conversations"
      on public.conversations
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'users own messages'
  ) then
    create policy "users own messages"
      on public.messages
      for all
      using (
        conversation_id in (
          select id from public.conversations where user_id = auth.uid()
        )
      )
      with check (
        conversation_id in (
          select id from public.conversations where user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bookmarks'
      and policyname = 'users own bookmarks'
  ) then
    create policy "users own bookmarks"
      on public.bookmarks
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
