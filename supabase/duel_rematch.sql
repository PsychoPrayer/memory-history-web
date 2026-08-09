-- Rematch / leave helpers for existing duel installs.
-- Run (or re-run) in Supabase SQL Editor — safe to run multiple times.

-- Otra ronda: same room + players, wipe results, start countdown if level set.
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

  /* Idempotent: if someone already rematched, return current row. */
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

-- Leave room: guest frees seat; host cancels the room.
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
