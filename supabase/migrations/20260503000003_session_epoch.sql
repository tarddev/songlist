alter table public.site_secrets
  add column if not exists session_epoch bigint not null default 1;

create or replace function public.bump_session_epoch()
returns trigger
language plpgsql
as $$
begin
  if new.passcode_hash is distinct from old.passcode_hash then
    new.session_epoch := old.session_epoch + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists site_secrets_bump_epoch on public.site_secrets;
create trigger site_secrets_bump_epoch
  before update on public.site_secrets
  for each row
  execute function public.bump_session_epoch();
