-- Memory History: account recovery codes, self-service deletion and name reports.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query). Safe to re-run.
-- Requires daily.sql to have been run first.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Recovery codes
-- Players have no email, so a one-time code is the only way back into an
-- account. Only a bcrypt hash of the code is stored; nobody can read it.
-- ---------------------------------------------------------------------------

create table if not exists public.account_recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_attempts (
  id bigserial primary key,
  login text not null,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);

create index if not exists recovery_attempts_login_idx
  on public.recovery_attempts (login, attempted_at);

-- RLS on and no policies: only the security-definer functions below touch these.
alter table public.account_recovery enable row level security;
alter table public.recovery_attempts enable row level security;

-- 16 characters from a 32-letter alphabet without look-alikes (no I, O, 0, 1):
-- 80 bits of randomness, shown as XXXX-XXXX-XXXX-XXXX.
create or replace function public.new_recovery_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(16);
  code text := '';
begin
  for i in 0..15 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    if i in (3, 7, 11) then
      code := code || '-';
    end if;
  end loop;
  return code;
end;
$$;

revoke all on function public.new_recovery_code() from public, anon, authenticated;

-- Hash of the code without dashes, so players can type it with or without them.
create or replace function public.hash_recovery_code(p_code text)
returns text
language sql
set search_path = ''
as $$
  select extensions.crypt(
    upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')),
    extensions.gen_salt('bf')
  );
$$;

revoke all on function public.hash_recovery_code(text) from public, anon, authenticated;

-- Signed-in player: create (or replace) their code. Returns it once, in clear.
create or replace function public.create_recovery_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  code text;
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  code := public.new_recovery_code();
  insert into public.account_recovery (user_id, code_hash)
  values (uid, public.hash_recovery_code(code))
  on conflict (user_id) do update
    set code_hash = excluded.code_hash, created_at = now();
  return code;
end;
$$;

revoke all on function public.create_recovery_code() from public, anon;
grant execute on function public.create_recovery_code() to authenticated;

-- Anyone: login (internal email) + code + new password. Returns a JSON status
-- instead of raising, so failed attempts are recorded for rate limiting.
create or replace function public.recover_account(
  p_login text,
  p_code text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_login text := lower(trim(coalesce(p_login, '')));
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_user uuid;
  v_hash text;
  v_new text;
begin
  if char_length(coalesce(p_new_password, '')) < 6 then
    return jsonb_build_object('ok', false, 'error', 'weak_password');
  end if;

  delete from public.recovery_attempts where attempted_at < now() - interval '1 day';

  if (
    select count(*) from public.recovery_attempts
    where login = v_login and not succeeded and attempted_at > now() - interval '1 hour'
  ) >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  select u.id, r.code_hash into v_user, v_hash
  from auth.users u
  join public.account_recovery r on r.user_id = u.id
  where lower(u.email) = v_login;

  if v_user is null or extensions.crypt(v_code, v_hash) <> v_hash then
    insert into public.recovery_attempts (login, succeeded) values (v_login, false);
    return jsonb_build_object('ok', false, 'error', 'invalid_recovery');
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = v_user;

  -- Sign the account out everywhere: whoever had the old password is out.
  delete from auth.sessions where user_id = v_user;

  insert into public.recovery_attempts (login, succeeded) values (v_login, true);

  -- A used code is spent: hand out the next one.
  v_new := public.new_recovery_code();
  update public.account_recovery
  set code_hash = public.hash_recovery_code(v_new), created_at = now()
  where user_id = v_user;

  return jsonb_build_object('ok', true, 'code', v_new);
end;
$$;

revoke all on function public.recover_account(text, text, text) from public;
grant execute on function public.recover_account(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Self-service deletion
-- Every table references auth.users with on delete cascade (saves, daily
-- results, duels, recovery codes, reports), so this removes all their data.
-- ---------------------------------------------------------------------------

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------------
-- Name moderation
-- ---------------------------------------------------------------------------

-- Offensive-word check shared by the leaderboard trigger. Mirrors
-- src/lib/nameFilter.ts: letters only, common digit swaps undone.
create or replace function public.name_is_blocked(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
      translate(lower(coalesce(p_name, '')), '013457@$', 'oieastas'),
      '[^a-zñ]', '', 'g'
    )
    ~ '(mierd|pendej|cabron|verga|gilipoll|maricon|malparid|hijueput|hijodeput|culiao|mamaguev|mamahuev|coño|putit|puto|(?<!re)puta($|[^d])|zorra|follar|fuck|shit|bitch|cunt|nigg|fagg|whore|slut|retard|nazi|hitler|porn|pussy)';
$$;

-- On every new leaderboard row: replace blocked names, and keep players with
-- three or more reports hidden on later days too. Its own trigger, so
-- re-running daily.sql never drops it. Definer rights to count the reports.
create or replace function public.daily_results_name_filter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.name_is_blocked(new.player_name) then
    new.player_name := 'Explorador';
  end if;
  if (select count(*) from public.name_reports where reported_id = new.user_id) >= 3 then
    new.hidden := true;
  end if;
  return new;
end;
$$;

drop trigger if exists daily_results_name_filter on public.daily_results;
create trigger daily_results_name_filter
  before insert on public.daily_results
  for each row execute function public.daily_results_name_filter();

alter table public.daily_results add column if not exists hidden boolean not null default false;

-- Hidden players still see their own rows; everyone else does not.
drop policy if exists "Anyone reads daily results" on public.daily_results;
create policy "Anyone reads daily results"
  on public.daily_results
  for select
  to anon, authenticated
  using (not hidden or auth.uid() = user_id);

create table if not exists public.name_reports (
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('offensive', 'impersonation', 'other')),
  reported_name text,
  created_at timestamptz not null default now(),
  primary key (reporter_id, reported_id)
);

alter table public.name_reports enable row level security;

drop policy if exists "Users report other players" on public.name_reports;
create policy "Users report other players"
  on public.name_reports
  for insert
  to authenticated
  with check (auth.uid() = reporter_id and reporter_id <> reported_id);

-- Three different players reporting the same name hides it from every
-- leaderboard until reviewed (set hidden = false in the dashboard to restore).
create or replace function public.name_reports_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.name_reports where reported_id = new.reported_id) >= 3 then
    update public.daily_results set hidden = true where user_id = new.reported_id;
  end if;
  return new;
end;
$$;

drop trigger if exists name_reports_hide on public.name_reports;
create trigger name_reports_hide
  after insert on public.name_reports
  for each row execute function public.name_reports_hide();
