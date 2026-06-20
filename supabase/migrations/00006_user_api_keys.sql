-- User API keys table for server-side encrypted key storage.
-- encrypted_key stores a base64 JSON blob with { iv, ciphertext }
-- produced by AES-256-GCM on the server. The plaintext key is never
-- stored or exposed to the client.

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
