-- Memory History real-time duels (parallel race).
-- Run in Supabase SQL editor after schema.sql.
-- Then: Database → Replication → enable Realtime for duel_matches and duel_results.

create table if not exists public.duel_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  wins int not null default 0 check (wins >= 0),
  losses int not null default 0 check (losses >= 0),
  draws int not null default 0 check (draws >= 0),
  updated_at timestamptz not null default now(),
  constraint duel_profiles_username_format
    check (username ~ '^[A-Za-z0-9_]{3,16}$')
);

create unique index if not exists duel_profiles_username_lower_idx
  on public.duel_profiles (lower(username));

alter table public.duel_profiles enable row level security;

drop policy if exists "Profiles are readable" on public.duel_profiles;
create policy "Profiles are readable"
  on public.duel_profiles for select
  to authenticated
  using (true);

drop policy if exists "Users insert own profile" on public.duel_profiles;
create policy "Users insert own profile"
  on public.duel_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own profile" on public.duel_profiles;
create policy "Users update own profile"
  on public.duel_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.duel_matches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid not null references auth.users (id) on delete cascade,
  guest_id uuid references auth.users (id) on delete set null,
  status text not null default 'lobby'
    check (status in (
      'lobby',
      'countdown',
      'playing',
      'awaiting_results',
      'finished',
      'cancelled'
    )),
  rules jsonb not null default '{}'::jsonb,
  host_ready boolean not null default false,
  guest_ready boolean not null default false,
  starts_at timestamptz,
  winner_id uuid references auth.users (id) on delete set null,
  is_draw boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists duel_matches_code_idx on public.duel_matches (code);
create index if not exists duel_matches_host_idx on public.duel_matches (host_id);
create index if not exists duel_matches_guest_idx on public.duel_matches (guest_id);

alter table public.duel_matches enable row level security;

drop policy if exists "Players read their matches" on public.duel_matches;
create policy "Players read their matches"
  on public.duel_matches for select
  to authenticated
  using (
    host_id = auth.uid()
    or guest_id = auth.uid()
    or (guest_id is null and status = 'lobby')
  );

drop policy if exists "Host creates matches" on public.duel_matches;
create policy "Host creates matches"
  on public.duel_matches for insert
  to authenticated
  with check (host_id = auth.uid());

drop policy if exists "Players update their matches" on public.duel_matches;
create policy "Players update their matches"
  on public.duel_matches for update
  to authenticated
  using (host_id = auth.uid() or guest_id = auth.uid())
  with check (host_id = auth.uid() or guest_id = auth.uid());

create table if not exists public.duel_results (
  match_id uuid not null references public.duel_matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  completed boolean not null default false,
  forfeited boolean not null default false,
  duration_ms int not null check (duration_ms >= 0),
  mistakes int not null check (mistakes >= 0),
  stars int not null check (stars >= 0 and stars <= 3),
  finished_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.duel_results enable row level security;

drop policy if exists "Players read match results" on public.duel_results;
create policy "Players read match results"
  on public.duel_results for select
  to authenticated
  using (
    exists (
      select 1 from public.duel_matches m
      where m.id = match_id
        and (m.host_id = auth.uid() or m.guest_id = auth.uid())
    )
  );

drop policy if exists "Players insert own result" on public.duel_results;
create policy "Players insert own result"
  on public.duel_results for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.duel_matches m
      where m.id = match_id
        and (m.host_id = auth.uid() or m.guest_id = auth.uid())
        and m.status in ('countdown', 'playing', 'awaiting_results')
    )
  );

-- Join open lobby by room code (atomic).
create or replace function public.join_duel(p_code text)
returns public.duel_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(p_code));
  row public.duel_matches;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.duel_matches
  set
    guest_id = auth.uid(),
    guest_ready = false,
    host_ready = false,
    updated_at = now()
  where code = normalized
    and status = 'lobby'
    and guest_id is null
    and host_id <> auth.uid()
  returning * into row;

  if row.id is null then
    raise exception 'Room not found or already full';
  end if;

  return row;
end;
$$;

revoke all on function public.join_duel(text) from public;
grant execute on function public.join_duel(text) to authenticated;

-- Compare both results and update wins/losses.
create or replace function public.resolve_duel(p_match_id uuid)
returns public.duel_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.duel_matches;
  host_r public.duel_results;
  guest_r public.duel_results;
  winner uuid;
  draw boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into m from public.duel_matches where id = p_match_id for update;
  if m.id is null then
    raise exception 'Match not found';
  end if;
  if m.host_id <> auth.uid() and m.guest_id <> auth.uid() then
    raise exception 'Not a player in this match';
  end if;
  if m.status = 'finished' then
    return m;
  end if;
  if m.guest_id is null then
    raise exception 'Match has no guest';
  end if;

  select * into host_r from public.duel_results
    where match_id = p_match_id and user_id = m.host_id;
  select * into guest_r from public.duel_results
    where match_id = p_match_id and user_id = m.guest_id;

  if host_r.user_id is null or guest_r.user_id is null then
    update public.duel_matches
    set status = 'awaiting_results', updated_at = now()
    where id = p_match_id
    returning * into m;
    return m;
  end if;

  -- Forfeit loses to a non-forfeit opponent.
  if host_r.forfeited and not guest_r.forfeited then
    winner := m.guest_id;
  elsif guest_r.forfeited and not host_r.forfeited then
    winner := m.host_id;
  elsif host_r.completed and not guest_r.completed then
    winner := m.host_id;
  elsif guest_r.completed and not host_r.completed then
    winner := m.guest_id;
  elsif not host_r.completed and not guest_r.completed then
    draw := true;
  elsif host_r.mistakes < guest_r.mistakes then
    winner := m.host_id;
  elsif guest_r.mistakes < host_r.mistakes then
    winner := m.guest_id;
  elsif host_r.duration_ms < guest_r.duration_ms then
    winner := m.host_id;
  elsif guest_r.duration_ms < host_r.duration_ms then
    winner := m.guest_id;
  else
    draw := true;
  end if;

  update public.duel_matches
  set
    status = 'finished',
    winner_id = winner,
    is_draw = draw,
    updated_at = now()
  where id = p_match_id
  returning * into m;

  if draw then
    update public.duel_profiles set draws = draws + 1, updated_at = now()
      where user_id in (m.host_id, m.guest_id);
  elsif winner is not null then
    update public.duel_profiles set wins = wins + 1, updated_at = now()
      where user_id = winner;
    update public.duel_profiles set losses = losses + 1, updated_at = now()
      where user_id = case when winner = m.host_id then m.guest_id else m.host_id end;
  end if;

  return m;
end;
$$;

revoke all on function public.resolve_duel(uuid) from public;
grant execute on function public.resolve_duel(uuid) to authenticated;

-- Optional: expose tables to Realtime
-- alter publication supabase_realtime add table public.duel_matches;
-- alter publication supabase_realtime add table public.duel_results;
