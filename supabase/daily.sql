-- Memory History daily challenge leaderboard.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run.

create table if not exists public.daily_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- UTC day of the challenge.
  day date not null,
  country text not null check (country in ('VE', 'ES', 'EU')),
  cards smallint not null check (cards between 4 and 60),
  seconds integer not null check (seconds between 1 and 3600),
  mistakes integer not null check (mistakes between 0 and 999),
  -- Each mistake adds 3 seconds; lower is better.
  score integer generated always as (seconds + mistakes * 3) stored,
  player_name text not null check (char_length(player_name) between 1 and 16),
  avatar_id text check (avatar_id is null or char_length(avatar_id) <= 40),
  created_at timestamptz not null default now(),
  -- Only the first attempt per day and country counts.
  primary key (user_id, day, country)
);

-- No backfilling old days or submitting future ones (1 day of slack for clocks).
-- A trigger rather than a CHECK, so backups of past rows restore cleanly.
create or replace function public.daily_results_recent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if new.day < today - 1 or new.day > today + 1 then
    raise exception 'daily result day % is out of range', new.day;
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists daily_results_recent on public.daily_results;
create trigger daily_results_recent
  before insert on public.daily_results
  for each row execute function public.daily_results_recent();

create index if not exists daily_results_board_idx
  on public.daily_results (day, country, score, created_at);

alter table public.daily_results enable row level security;

-- Anyone can read the leaderboard (only names, avatars and times are stored).
drop policy if exists "Anyone reads daily results" on public.daily_results;
create policy "Anyone reads daily results"
  on public.daily_results
  for select
  to anon, authenticated
  using (true);

-- Players insert only their own result. No update or delete: the first attempt stands.
drop policy if exists "Users insert own daily result" on public.daily_results;
create policy "Users insert own daily result"
  on public.daily_results
  for insert
  to authenticated
  with check (auth.uid() = user_id);
