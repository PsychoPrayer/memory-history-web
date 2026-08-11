import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import type { CountryCode, FreeDeck } from '../types'

export type DuelStatus =
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'awaiting_results'
  | 'finished'
  | 'cancelled'

/** Pack for the duel board: campaign countries or PancitoLandia free deck. */
export interface DuelRules {
  country: FreeDeck
  /** Campaign level id, or `pl:{cardCount}` for PancitoLandia. */
  levelId: string
}

export const DUEL_FREE_CARD_COUNTS = [12, 16, 20, 24, 28, 32, 40] as const

export function isCampaignDuelPack(pack: FreeDeck): pack is CountryCode {
  return pack !== 'PL'
}

export function plDuelLevelId(cards: number): string {
  return `pl:${cards}`
}

export function parsePlDuelCards(levelId: string): number | null {
  const match = /^pl:(\d+)$/.exec(levelId)
  if (!match) return null
  const cards = Number(match[1])
  return Number.isFinite(cards) && cards > 0 ? cards : null
}

export function gridForDuelCards(cards: number): {
  columns: number
  rows: number
} {
  const presets: Record<number, { columns: number; rows: number }> = {
    12: { columns: 4, rows: 3 },
    16: { columns: 4, rows: 4 },
    20: { columns: 5, rows: 4 },
    24: { columns: 6, rows: 4 },
    28: { columns: 7, rows: 4 },
    32: { columns: 8, rows: 4 },
    40: { columns: 8, rows: 5 },
  }
  return presets[cards] ?? { columns: 4, rows: Math.max(1, Math.ceil(cards / 4)) }
}

export interface DuelProfile {
  user_id: string
  username: string
  /** Avatar id from local catalog (`pl:…` / `ui:…`). */
  avatar_id: string | null
  wins: number
  losses: number
  draws: number
  updated_at: string
}

export interface DuelMatch {
  id: string
  code: string
  host_id: string
  guest_id: string | null
  status: DuelStatus
  rules: DuelRules
  host_ready: boolean
  guest_ready: boolean
  starts_at: string | null
  winner_id: string | null
  is_draw: boolean
  created_at: string
  updated_at: string
}

export interface DuelResult {
  match_id: string
  user_id: string
  completed: boolean
  forfeited: boolean
  duration_ms: number
  mistakes: number
  stars: number
  finished_at: string
}

export interface SubmitDuelResultInput {
  completed: boolean
  forfeited?: boolean
  durationMs: number
  mistakes: number
  stars: number
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function requireClient() {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

/** Normalize Supabase / unknown errors for UI. */
export function duelErrorMessage(err: unknown, fallback = 'Duel error'): string {
  if (typeof err === 'string' && err.trim()) return err
  if (err && typeof err === 'object') {
    const record = err as { message?: unknown; code?: unknown; details?: unknown }
    const message = typeof record.message === 'string' ? record.message : ''
    if (message) {
      if (
        /rematch_duel|leave_duel|REMATCH_SETUP_NEEDED|Could not find the function/i.test(
          message,
        )
      ) {
        return 'REMATCH_SETUP_NEEDED'
      }
      if (
        /Could not find the table.*duel_|relation ["']?public\.duel_/i.test(message) ||
        (/duel_profiles/i.test(message) && /schema cache|does not exist/i.test(message))
      ) {
        return 'DUEL_SETUP_NEEDED'
      }
      return message
    }
  }
  if (err instanceof Error && err.message) {
    return duelErrorMessage({ message: err.message }, fallback)
  }
  return fallback
}

function normalizeUsername(raw: string): string {
  return raw.trim()
}

export function isValidUsername(raw: string): boolean {
  return /^[A-Za-z0-9_]{3,16}$/.test(normalizeUsername(raw))
}

function randomCode(length = 6): string {
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length]
  }
  return code
}

function asRules(value: unknown): DuelRules {
  if (!value || typeof value !== 'object') {
    return { country: 'VE', levelId: '' }
  }
  const record = value as Record<string, unknown>
  const raw =
    typeof record.country === 'string' ? record.country.toUpperCase() : 'VE'
  const country = (
    raw === 'ES' || raw === 'EU' || raw === 'PL' ? raw : 'VE'
  ) as FreeDeck
  const levelId = typeof record.levelId === 'string' ? record.levelId : ''
  return { country, levelId }
}

function mapMatch(row: Record<string, unknown>): DuelMatch {
  return {
    id: String(row.id),
    code: String(row.code),
    host_id: String(row.host_id),
    guest_id: row.guest_id ? String(row.guest_id) : null,
    status: row.status as DuelStatus,
    rules: asRules(row.rules),
    host_ready: Boolean(row.host_ready),
    guest_ready: Boolean(row.guest_ready),
    starts_at: row.starts_at ? String(row.starts_at) : null,
    winner_id: row.winner_id ? String(row.winner_id) : null,
    is_draw: Boolean(row.is_draw),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapProfile(row: Record<string, unknown>): DuelProfile {
  return {
    user_id: String(row.user_id),
    username: String(row.username),
    avatar_id:
      typeof row.avatar_id === 'string' && row.avatar_id
        ? row.avatar_id
        : null,
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    draws: Number(row.draws) || 0,
    updated_at: String(row.updated_at),
  }
}

/** Map a display name to a duel username (letters, numbers, _). */
export function duelUsernameFromPlayerName(name: string): string {
  let clean = name
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  if (clean.length < 3) clean = `${clean}player`.slice(0, 16)
  return clean.slice(0, 16)
}

function mapResult(row: Record<string, unknown>): DuelResult {
  return {
    match_id: String(row.match_id),
    user_id: String(row.user_id),
    completed: Boolean(row.completed),
    forfeited: Boolean(row.forfeited),
    duration_ms: Number(row.duration_ms) || 0,
    mistakes: Number(row.mistakes) || 0,
    stars: Number(row.stars) || 0,
    finished_at: String(row.finished_at),
  }
}

export async function fetchMyProfile(userId: string): Promise<DuelProfile | null> {
  const supabase = requireClient()
  const { data, error } = await supabase
    .from('duel_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? mapProfile(data as Record<string, unknown>) : null
}

export async function fetchProfiles(userIds: string[]): Promise<DuelProfile[]> {
  if (userIds.length === 0) return []
  const supabase = requireClient()
  const { data, error } = await supabase
    .from('duel_profiles')
    .select('*')
    .in('user_id', userIds)
  if (error) throw error
  return (data ?? []).map((row) => mapProfile(row as Record<string, unknown>))
}

export async function claimUsername(
  user: User,
  username: string,
  avatarId?: string | null,
): Promise<DuelProfile> {
  const supabase = requireClient()
  const clean = normalizeUsername(username)
  if (!isValidUsername(clean)) {
    throw new Error('Invalid username')
  }
  const payload: Record<string, unknown> = {
    user_id: user.id,
    username: clean,
    updated_at: new Date().toISOString(),
  }
  if (avatarId) payload.avatar_id = avatarId

  const { data, error } = await supabase
    .from('duel_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('USERNAME_TAKEN')
    /* Column missing until duel_avatar.sql is applied — retry without avatar. */
    if (avatarId && /avatar_id/i.test(error.message)) {
      return claimUsername(user, username, null)
    }
    throw new Error(duelErrorMessage(error, error.message || 'Duel error'))
  }
  return mapProfile(data as Record<string, unknown>)
}

/**
 * Keep cloud duel profile aligned with the local menu name + avatar.
 */
export async function syncDuelProfile(
  user: User,
  playerName: string,
  avatarId: string,
): Promise<DuelProfile> {
  const existing = await fetchMyProfile(user.id)
  const preferred = duelUsernameFromPlayerName(playerName)
  const username = existing?.username || preferred

  try {
    return await claimUsername(user, username, avatarId)
  } catch (err) {
    if (
      err instanceof Error &&
      err.message === 'USERNAME_TAKEN' &&
      !existing
    ) {
      const suffix = String(Math.floor(Math.random() * 900) + 100)
      const fallback = `${preferred.slice(0, 12)}${suffix}`
      return claimUsername(user, fallback, avatarId)
    }
    throw err
  }
}

export async function createDuel(
  user: User,
  rules: DuelRules,
): Promise<DuelMatch> {
  const supabase = requireClient()
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode()
    const { data, error } = await supabase
      .from('duel_matches')
      .insert({
        code,
        host_id: user.id,
        status: 'lobby',
        rules,
        host_ready: false,
        guest_ready: false,
      })
      .select('*')
      .single()
    if (!error && data) return mapMatch(data as Record<string, unknown>)
    lastError = error
    if (error?.code !== '23505') break
  }
  throw lastError instanceof Error ? lastError : new Error('Could not create room')
}

export async function joinDuel(code: string): Promise<DuelMatch> {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('join_duel', {
    p_code: code.trim().toUpperCase(),
  })
  if (error) throw error
  return mapMatch(data as Record<string, unknown>)
}

export async function fetchMatch(matchId: string): Promise<DuelMatch | null> {
  const supabase = requireClient()
  const { data, error } = await supabase
    .from('duel_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle()
  if (error) throw error
  return data ? mapMatch(data as Record<string, unknown>) : null
}

export async function fetchResults(matchId: string): Promise<DuelResult[]> {
  const supabase = requireClient()
  const { data, error } = await supabase
    .from('duel_results')
    .select('*')
    .eq('match_id', matchId)
  if (error) throw error
  return (data ?? []).map((row) => mapResult(row as Record<string, unknown>))
}

export async function updateMatchRules(
  matchId: string,
  rules: DuelRules,
): Promise<void> {
  const supabase = requireClient()
  const { error } = await supabase
    .from('duel_matches')
    .update({
      rules,
      host_ready: false,
      guest_ready: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'lobby')
  if (error) throw error
}

export async function setReady(
  match: DuelMatch,
  userId: string,
  ready: boolean,
): Promise<void> {
  const supabase = requireClient()
  const patch =
    match.host_id === userId
      ? { host_ready: ready, updated_at: new Date().toISOString() }
      : { guest_ready: ready, updated_at: new Date().toISOString() }
  const { error } = await supabase
    .from('duel_matches')
    .update(patch)
    .eq('id', match.id)
    /* Lobby ready-up, or mutual rematch vote after a finished duel. */
    .in('status', ['lobby', 'finished'])
  if (error) throw error
}

export function rematchVotes(match: DuelMatch, userId: string) {
  const iAmReady = isHost(match, userId) ? match.host_ready : match.guest_ready
  const theyAreReady = isHost(match, userId)
    ? match.guest_ready
    : match.host_ready
  return { iAmReady, theyAreReady, bothReady: iAmReady && theyAreReady }
}

export async function startCountdown(matchId: string): Promise<void> {
  const supabase = requireClient()
  const startsAt = new Date(Date.now() + 3500).toISOString()
  const { error } = await supabase
    .from('duel_matches')
    .update({
      status: 'countdown',
      starts_at: startsAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'lobby')
  if (error) throw error
}

export async function markPlaying(matchId: string): Promise<void> {
  const supabase = requireClient()
  const { error } = await supabase
    .from('duel_matches')
    .update({
      status: 'playing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .in('status', ['countdown', 'playing'])
  if (error) throw error
}

export async function cancelMatch(matchId: string): Promise<void> {
  const supabase = requireClient()
  const { error } = await supabase
    .from('duel_matches')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .in('status', ['lobby', 'countdown'])
  if (error) throw error
}

export async function submitDuelResult(
  matchId: string,
  userId: string,
  input: SubmitDuelResultInput,
): Promise<DuelMatch> {
  const supabase = requireClient()
  const { error: upsertError } = await supabase.from('duel_results').upsert(
    {
      match_id: matchId,
      user_id: userId,
      completed: input.completed,
      forfeited: Boolean(input.forfeited),
      duration_ms: Math.max(0, Math.round(input.durationMs)),
      mistakes: Math.max(0, input.mistakes),
      stars: Math.min(3, Math.max(0, input.stars)),
      finished_at: new Date().toISOString(),
    },
    { onConflict: 'match_id,user_id' },
  )
  if (upsertError) throw upsertError

  const { data, error } = await supabase.rpc('resolve_duel', {
    p_match_id: matchId,
  })
  if (error) throw error
  let mapped = mapMatch(data as Record<string, unknown>)

  /* Ensure rematch votes start clean (older resolve_duel left ready=true). */
  if (
    mapped.status === 'finished' &&
    (mapped.host_ready || mapped.guest_ready)
  ) {
    await supabase
      .from('duel_matches')
      .update({
        host_ready: false,
        guest_ready: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('status', 'finished')
    const refreshed = await fetchMatch(matchId)
    if (refreshed) mapped = refreshed
  }

  return mapped
}

async function rematchDuelClient(matchId: string): Promise<DuelMatch> {
  const supabase = requireClient()
  const current = await fetchMatch(matchId)
  if (!current) throw new Error('REMATCH_SETUP_NEEDED')
  if (
    current.status === 'lobby' ||
    current.status === 'countdown' ||
    current.status === 'playing'
  ) {
    return current
  }
  if (current.status !== 'finished') throw new Error('Match is not finished')

  const { error: deleteError } = await supabase
    .from('duel_results')
    .delete()
    .eq('match_id', matchId)
  if (deleteError) throw new Error('REMATCH_SETUP_NEEDED')

  /* Back to lobby so the host can keep or change deck/level before ready-up. */
  const { data, error } = await supabase
    .from('duel_matches')
    .update({
      status: 'lobby' as const,
      host_ready: false,
      guest_ready: false,
      starts_at: null,
      winner_id: null,
      is_draw: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select('*')
    .single()
  if (error || !data) throw new Error('REMATCH_SETUP_NEEDED')
  return mapMatch(data as Record<string, unknown>)
}

export async function rematchDuel(matchId: string): Promise<DuelMatch> {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('rematch_duel', {
    p_match_id: matchId,
  })
  if (!error && data) return mapMatch(data as Record<string, unknown>)
  return rematchDuelClient(matchId)
}

export async function leaveDuel(matchId: string): Promise<DuelMatch> {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('leave_duel', {
    p_match_id: matchId,
  })
  if (!error && data) return mapMatch(data as Record<string, unknown>)

  const current = await fetchMatch(matchId)
  if (!current) throw error ?? new Error('Match not found')

  const { data: sessionData } = await supabase.auth.getSession()
  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('Not authenticated')

  if (current.host_id === userId) {
    await supabase.from('duel_results').delete().eq('match_id', matchId)
    const { data: updated, error: upError } = await supabase
      .from('duel_matches')
      .update({
        status: 'cancelled',
        guest_id: null,
        host_ready: false,
        guest_ready: false,
        starts_at: null,
        winner_id: null,
        is_draw: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .select('*')
      .single()
    if (upError || !updated) throw upError ?? new Error('Could not leave')
    return mapMatch(updated as Record<string, unknown>)
  }

  await supabase.from('duel_results').delete().eq('match_id', matchId)
  const { data: updated, error: upError } = await supabase
    .from('duel_matches')
    .update({
      guest_id: null,
      status: 'lobby',
      host_ready: false,
      guest_ready: false,
      starts_at: null,
      winner_id: null,
      is_draw: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .select('*')
    .single()
  if (upError || !updated) throw upError ?? new Error('Could not leave')
  return mapMatch(updated as Record<string, unknown>)
}

const ROOM_STORAGE_KEY = 'mh-duel-room'
const INVITE_STORAGE_KEY = 'mh-duel-invite'
/** Invite links expire so a closed room cannot trap a guest forever. */
const INVITE_TTL_MS = 10 * 60 * 1000

/** How long a mid-match room may be auto-resumed after leaving Duel. */
const RESUME_ACTIVE_MS = 5 * 60 * 1000

/**
 * Lobby / finished: always safe to reopen.
 * Countdown / playing / awaiting: only if the match was touched recently,
 * so an abandoned game does not yank you back into a board.
 */
export function isDuelRoomResumable(match: DuelMatch): boolean {
  if (match.status === 'cancelled') return false
  if (match.status === 'lobby' || match.status === 'finished') return true

  const stamp = match.updated_at || match.starts_at
  if (!stamp) return false
  const age = Date.now() - new Date(stamp).getTime()
  if (Number.isNaN(age) || age < 0) return false
  return age <= RESUME_ACTIVE_MS
}

export function rememberDuelRoom(matchId: string) {
  try {
    sessionStorage.setItem(ROOM_STORAGE_KEY, matchId)
  } catch {
    /* ignore */
  }
}

export function forgetDuelRoom() {
  try {
    sessionStorage.removeItem(ROOM_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function recalledDuelRoom(): string | null {
  try {
    return sessionStorage.getItem(ROOM_STORAGE_KEY)
  } catch {
    return null
  }
}

export function normalizeRoomCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}

export function rememberInviteCode(code: string) {
  const clean = normalizeRoomCode(code)
  if (!clean) return
  try {
    sessionStorage.setItem(
      INVITE_STORAGE_KEY,
      JSON.stringify({ code: clean, at: Date.now() }),
    )
  } catch {
    /* ignore */
  }
}

export function forgetInviteCode() {
  try {
    sessionStorage.removeItem(INVITE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function recalledInviteCode(): string | null {
  try {
    const raw = sessionStorage.getItem(INVITE_STORAGE_KEY)
    if (!raw) return null

    /* Legacy: plain code string from earlier builds. */
    if (raw.length <= 8 && !raw.startsWith('{')) {
      const clean = normalizeRoomCode(raw)
      if (!clean) {
        forgetInviteCode()
        return null
      }
      /* Treat legacy invites as expired so stuck guests self-heal. */
      forgetInviteCode()
      return null
    }

    const parsed = JSON.parse(raw) as { code?: unknown; at?: unknown }
    const code =
      typeof parsed.code === 'string' ? normalizeRoomCode(parsed.code) : ''
    const at = typeof parsed.at === 'number' ? parsed.at : 0
    if (!code || !at || Date.now() - at > INVITE_TTL_MS) {
      forgetInviteCode()
      return null
    }
    return code
  } catch {
    forgetInviteCode()
    return null
  }
}

export function subscribeToMatch(
  matchId: string,
  onChange: () => void,
): () => void {
  const supabase = getSupabase()
  if (!supabase) return () => undefined

  const channel: RealtimeChannel = supabase
    .channel(`duel-${matchId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'duel_matches',
        filter: `id=eq.${matchId}`,
      },
      () => onChange(),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'duel_results',
        filter: `match_id=eq.${matchId}`,
      },
      () => onChange(),
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export function isHost(match: DuelMatch, userId: string): boolean {
  return match.host_id === userId
}

export function bothReady(match: DuelMatch): boolean {
  return Boolean(match.guest_id && match.host_ready && match.guest_ready)
}

export function opponentId(match: DuelMatch, userId: string): string | null {
  if (match.host_id === userId) return match.guest_id
  return match.host_id
}
