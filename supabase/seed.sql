-- Default passcode for local dev. Change before deploying.
insert into public.site_secrets (id, passcode_hash)
values (1, extensions.crypt('changeme', extensions.gen_salt('bf')))
on conflict (id) do nothing;
