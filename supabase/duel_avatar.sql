-- Avatar on duel profiles (same catalog as the local menu picker).
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.duel_profiles
  add column if not exists avatar_id text;

comment on column public.duel_profiles.avatar_id is
  'Avatar id from the web catalog (ui:happy, pl:12, …).';
