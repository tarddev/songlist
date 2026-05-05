-- Poll nominations: unprivileged users can nominate new options; privileged
-- users can delete any option (creator or nominated).

alter table public.poll_options
  add column if not exists nominated_at timestamptz;

-- ── RPC: nominate_option ─────────────────────────────────────────────────────
-- Serializes index allocation and lazy-close check via FOR UPDATE on the poll
-- row. Returns 'ok:<optionIndex>' on success, or an error token.
create or replace function public.nominate_option(
  p_poll_id  uuid,
  p_song     text,
  p_artist   text,
  p_genre    text,
  p_mood     text,
  p_language text
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed_at  timestamptz;
  v_closes_at  timestamptz;
  v_nom_count  int;
  v_next_idx   smallint;
begin
  select closed_at, closes_at into v_closed_at, v_closes_at
  from public.polls where id = p_poll_id for update;

  if not found then
    return 'not_found';
  end if;

  if v_closed_at is not null then
    return 'closed';
  end if;

  if v_closes_at is not null and v_closes_at <= now() then
    update public.polls set closed_at = v_closes_at where id = p_poll_id;
    return 'closed';
  end if;

  select count(*) into v_nom_count
  from public.poll_options
  where poll_id = p_poll_id and nominated_at is not null;

  if v_nom_count >= 10 then
    return 'limit_reached';
  end if;

  select coalesce(max(option_index), 0) + 1 into v_next_idx
  from public.poll_options where poll_id = p_poll_id;

  insert into public.poll_options
    (poll_id, option_index, song, artist, genre, mood, language, nominated_at)
  values (
    p_poll_id,
    v_next_idx,
    nullif(btrim(coalesce(p_song,     '')), ''),
    nullif(btrim(coalesce(p_artist,   '')), ''),
    nullif(btrim(coalesce(p_genre,    '')), ''),
    nullif(btrim(coalesce(p_mood,     '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    now()
  );

  return 'ok:' || v_next_idx::text;
end;
$$;

revoke all on function public.nominate_option(uuid, text, text, text, text, text) from public;
grant execute on function public.nominate_option(uuid, text, text, text, text, text) to service_role;

-- ── RPC: delete_poll_option ──────────────────────────────────────────────────
-- Removes votes for the option first, then the option row. Returns 'ok' or
-- 'not_found'.
create or replace function public.delete_poll_option(
  p_poll_id      uuid,
  p_option_index smallint
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted int;
begin
  delete from public.poll_votes
  where poll_id = p_poll_id and option_index = p_option_index;

  delete from public.poll_options
  where poll_id = p_poll_id and option_index = p_option_index;

  get diagnostics v_deleted = row_count;

  if v_deleted = 0 then
    return 'not_found';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.delete_poll_option(uuid, smallint) from public;
grant execute on function public.delete_poll_option(uuid, smallint) to service_role;
