-- Songs table: the public song list shown on the homepage. Each poll that
-- closes contributes its winning option as a new row (via trigger below).

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  song text,
  artist text,
  genre text,
  notes text,
  poll_id uuid references public.polls(id) on delete set null,
  added_at timestamptz not null default now(),
  constraint songs_at_least_one_field check (
    coalesce(nullif(btrim(song), ''), nullif(btrim(artist), ''),
             nullif(btrim(genre), ''), nullif(btrim(notes), '')) is not null
  )
);

-- One winning song per poll. Partial so manually-seeded rows (poll_id null)
-- are unconstrained.
create unique index if not exists songs_unique_poll
  on public.songs (poll_id) where poll_id is not null;

create index if not exists songs_added_at_idx
  on public.songs (added_at desc);

alter table public.songs enable row level security;
-- No anon/authenticated policies. Reads go through the service-role client
-- in api/songs.js; writes happen only via the trigger below.

-- ── Trigger: on poll close, insert the winning option as a song ─────────────
create or replace function public.handle_poll_close()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_winner_index smallint;
  v_opt record;
begin
  select option_index into v_winner_index
  from public.poll_votes
  where poll_id = new.id
  group by option_index
  order by count(*) desc, option_index asc
  limit 1;

  if v_winner_index is null then
    return new;
  end if;

  select song, artist, genre, notes into v_opt
  from public.poll_options
  where poll_id = new.id and option_index = v_winner_index;

  if not found then
    return new;
  end if;

  insert into public.songs (poll_id, song, artist, genre, notes)
  values (new.id, v_opt.song, v_opt.artist, v_opt.genre, v_opt.notes)
  on conflict (poll_id) where poll_id is not null do nothing;

  return new;
end;
$$;

drop trigger if exists polls_after_close on public.polls;
create trigger polls_after_close
  after update of closed_at on public.polls
  for each row
  when (old.closed_at is null and new.closed_at is not null)
  execute function public.handle_poll_close();

-- ── Seed: existing CSV rows so the homepage isn't empty on launch ──────────
insert into public.songs (song, artist, genre, notes)
select * from (values
  ('Night Bloom',     'Kaneko Lumi',                                                           'Pop',  'Lemon'),
  ('Love Sucker',     'Kaneko Lumi, Jelly Hoshiumi',                                           'Rock', null),
  ('Pick Me Fever',   'Invaders WISH',                                                         'Rap',  null),
  ('Space Drive',     'Ember Amane',                                                           'Pop',  'Emburger'),
  ('Aino Protocol',   'Jelly Hoshiumi',                                                        null,   null),
  ('Haunt',           'Dizzy Dokuro',                                                          null,   null),
  ('Acid Rain',       'Invaders WISH, Kaneko Lumi, Dizzy Dokuro, Ember Amane, Jelly Hoshiumi', null,   null),
  ('Magnolia',        'Ember Amane, Dizzy Dokuro',                                             null,   null)
) as v(song, artist, genre, notes)
where not exists (select 1 from public.songs);
