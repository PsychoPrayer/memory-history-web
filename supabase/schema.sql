-- Memory History cloud save
-- Run this once in the Supabase SQL editor (Dashboard → SQL → New query).
-- For real-time duels, also run supabase/duel.sql and enable Realtime
-- on duel_matches + duel_results (Database → Publications).

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "Users read own save" on public.saves;
create policy "Users read own save"
  on public.saves
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users insert own save" on public.saves;
create policy "Users insert own save"
  on public.saves
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users update own save" on public.saves;
create policy "Users update own save"
  on public.saves
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users delete own save" on public.saves;
create policy "Users delete own save"
  on public.saves
  for delete
  to authenticated
  using (auth.uid() = user_id);
