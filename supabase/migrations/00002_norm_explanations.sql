-- Migration 00002: Norm explanations cache table
-- Stores AI-generated structured explanations per (norm, language).
-- The law stays German in the canonical store; translations are cached
-- on-demand only for norms users actually request.

create table if not exists public.norm_explanations (
  id          uuid primary key default gen_random_uuid(),
  norm_id     text not null,
  law_key     text not null,
  lang        text not null default 'en',
  translation text not null default '',
  summary     text not null default '',
  implications text not null default '',
  next_steps  text not null default '',
  created_at  timestamptz not null default now(),
  unique (norm_id, lang)
);

create index if not exists idx_norm_explanations_lookup
  on public.norm_explanations (norm_id, lang);

alter table public.norm_explanations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'norm_explanations'
      and policyname = 'norm_explanations are public'
  ) then
    create policy "norm_explanations are public"
      on public.norm_explanations
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'norm_explanations'
      and policyname = 'norm_explanations insert'
  ) then
    create policy "norm_explanations insert"
      on public.norm_explanations
      for insert
      with check (true);
  end if;
end
$$;
