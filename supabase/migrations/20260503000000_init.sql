create extension if not exists pgcrypto;

create table if not exists public.site_secrets (
  id int primary key default 1,
  passcode_hash text not null,
  updated_at timestamptz not null default now(),
  constraint site_secrets_single_row check (id = 1)
);

alter table public.site_secrets enable row level security;
-- no policies: anon and authenticated have no access. Only service_role
-- (used server-side) and the SECURITY DEFINER function below can touch it.

create or replace function public.verify_passcode(input_passcode text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_match boolean;
begin
  select passcode_hash = extensions.crypt(input_passcode, passcode_hash)
    into is_match
  from public.site_secrets
  where id = 1;
  return coalesce(is_match, false);
end;
$$;

revoke all on function public.verify_passcode(text) from public;
grant execute on function public.verify_passcode(text) to anon, authenticated, service_role;
