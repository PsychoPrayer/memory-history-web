-- REQUIRED for "Otra ronda". Run all of this in Supabase → SQL Editor → Run.
-- Safe to re-run.

-- Allow players to clear results when rematching (client fallback + RPC).
drop policy if exists "Players delete results for rematch" on public.duel_results;
create policy "Players delete results for rematch"
  on public.duel_results for delete
  to authenticated
  using (
    exists (
      select 1 from public.duel_matches m
      where m.id = match_id
        and (m.host_id = auth.uid() or m.guest_id = auth.uid())
        and m.status in ('finished', 'lobby', 'cancelled')
    )
  );

-- Also allow upsert updates on own result rows.
drop policy if exists "Players update own result" on public.duel_results;
create policy "Players update own result"
  on public.duel_results for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.rematch_duel(p_match_id uuid)
returns public.duel_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.duel_matches;
  level_id text;
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

  if m.status in ('lobby', 'countdown', 'playing') then
    return m;
  end if;

  if m.status <> 'finished' then
    raise exception 'Match is not finished';
  end if;
  if m.guest_id is null then
    raise exception 'Opponent left the room';
  end if;

  level_id := coalesce(m.rules->>'levelId', '');
  delete from public.duel_results where match_id = p_match_id;

  if level_id <> '' then
    update public.duel_matches
    set
      status = 'countdown',
      host_ready = true,
      guest_ready = true,
      starts_at = now() + interval '3.5 seconds',
      winner_id = null,
      is_draw = false,
      updated_at = now()
    where id = p_match_id
    returning * into m;
  else
    update public.duel_matches
    set
      status = 'lobby',
      host_ready = false,
      guest_ready = false,
      starts_at = null,
      winner_id = null,
      is_draw = false,
      updated_at = now()
    where id = p_match_id
    returning * into m;
  end if;

  return m;
end;
$$;

revoke all on function public.rematch_duel(uuid) from public;
grant execute on function public.rematch_duel(uuid) to authenticated;

create or replace function public.leave_duel(p_match_id uuid)
returns public.duel_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.duel_matches;
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

  if m.host_id = auth.uid() then
    delete from public.duel_results where match_id = p_match_id;
    update public.duel_matches
    set
      status = 'cancelled',
      guest_id = null,
      host_ready = false,
      guest_ready = false,
      starts_at = null,
      winner_id = null,
      is_draw = false,
      updated_at = now()
    where id = p_match_id
    returning * into m;
    return m;
  end if;

  delete from public.duel_results where match_id = p_match_id;
  update public.duel_matches
  set
    guest_id = null,
    status = case
      when m.status in ('finished', 'awaiting_results', 'countdown', 'playing') then 'lobby'
      else m.status
    end,
    host_ready = false,
    guest_ready = false,
    starts_at = null,
    winner_id = null,
    is_draw = false,
    updated_at = now()
  where id = p_match_id
  returning * into m;

  return m;
end;
$$;

revoke all on function public.leave_duel(uuid) from public;
grant execute on function public.leave_duel(uuid) to authenticated;
