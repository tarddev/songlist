-- Polls feature: a single-active poll with N>=2 song-record options and public voting.

create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  created_at timestamptz not null default now(),
  closes_at timestamptz,
  closed_at timestamptz,
  constraint polls_question_length check (char_length(question) between 1 and 500),
  constraint polls_closes_after_created check (closes_at is null or closes_at > created_at),
  constraint polls_closed_after_created check (closed_at is null or closed_at >= created_at)
);

-- At most one row may exist with closed_at IS NULL. The expression-based partial
-- unique index gives us atomic single-active enforcement at the DB layer.
create unique index if not exists polls_one_active
  on public.polls ((true)) where closed_at is null;

create table if not exists public.poll_options (
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_index smallint not null,
  song text,
  artist text,
  genre text,
  mood text,
  language text,
  primary key (poll_id, option_index),
  constraint poll_options_index_positive check (option_index >= 1),
  constraint poll_options_at_least_one_field check (
    coalesce(nullif(btrim(song), ''), nullif(btrim(artist), ''),
             nullif(btrim(genre), ''), nullif(btrim(mood), ''),
             nullif(btrim(language), '')) is not null
  )
);

create table if not exists public.poll_votes (
  id bigserial primary key,
  poll_id uuid not null references public.polls(id) on delete cascade,
  option_index smallint not null,
  voted_at timestamptz not null default now(),
  constraint poll_votes_option_positive check (option_index >= 1)
);

create index if not exists poll_votes_poll_option_idx
  on public.poll_votes (poll_id, option_index);

alter table public.polls         enable row level security;
alter table public.poll_options  enable row level security;
alter table public.poll_votes    enable row level security;
-- No anon/authenticated policies. All access goes through the service-role
-- client in api/* handlers or the SECURITY DEFINER RPCs below.

-- ── RPC: create_poll ────────────────────────────────────────────────────────
-- Inserts a polls row + N>=2 poll_options rows in one transaction. Relies on
-- the polls_one_active partial unique index to atomically reject creation
-- while another poll is active.
create or replace function public.create_poll(
  p_question text,
  p_options jsonb,
  p_closes_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  opt jsonb;
  i int := 0;
begin
  if p_question is null or btrim(p_question) = '' then
    raise exception 'question_required' using errcode = '22023';
  end if;
  if char_length(p_question) > 500 then
    raise exception 'question_too_long' using errcode = '22023';
  end if;
  if p_options is null or jsonb_typeof(p_options) <> 'array' then
    raise exception 'options_required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_options) < 2 then
    raise exception 'min_two_options' using errcode = '22023';
  end if;
  if jsonb_array_length(p_options) > 20 then
    raise exception 'too_many_options' using errcode = '22023';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'closes_at_in_past' using errcode = '22023';
  end if;

  insert into public.polls (question, closes_at)
  values (btrim(p_question), p_closes_at)
  returning id into new_id;

  for opt in select * from jsonb_array_elements(p_options) loop
    i := i + 1;
    insert into public.poll_options (poll_id, option_index, song, artist, genre, mood, language)
    values (
      new_id,
      i,
      nullif(btrim(coalesce(opt->>'song',     '')), ''),
      nullif(btrim(coalesce(opt->>'artist',   '')), ''),
      nullif(btrim(coalesce(opt->>'genre',    '')), ''),
      nullif(btrim(coalesce(opt->>'mood',     '')), ''),
      nullif(btrim(coalesce(opt->>'language', '')), '')
    );
  end loop;

  return new_id;
end;
$$;

revoke all on function public.create_poll(text, jsonb, timestamptz) from public;
grant execute on function public.create_poll(text, jsonb, timestamptz) to service_role;

-- ── RPC: cast_vote ─────────────────────────────────────────────────────────
-- Lazy auto-close: if closes_at has passed, set closed_at and reject. Returns
-- a short status string the API layer maps to HTTP codes.
create or replace function public.cast_vote(
  p_poll_id uuid,
  p_option_index smallint
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_closed_at timestamptz;
  v_closes_at timestamptz;
  v_option_exists boolean;
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

  select exists(
    select 1 from public.poll_options
    where poll_id = p_poll_id and option_index = p_option_index
  ) into v_option_exists;
  if not v_option_exists then
    return 'bad_option';
  end if;

  insert into public.poll_votes (poll_id, option_index)
  values (p_poll_id, p_option_index);

  return 'ok';
end;
$$;

revoke all on function public.cast_vote(uuid, smallint) from public;
grant execute on function public.cast_vote(uuid, smallint) to service_role;

-- ── RPC: close_active_poll ─────────────────────────────────────────────────
-- Closes whatever poll is currently active (closed_at is null). Returns the
-- closed poll's id, or null if no active poll exists.
create or replace function public.close_active_poll()
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  update public.polls
  set closed_at = now()
  where closed_at is null
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.close_active_poll() from public;
grant execute on function public.close_active_poll() to service_role;
