import type { RealtimeChannel, User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import type { CountryCode } from '../types'

export type DuelStatus =
  | 'lobby'
  | 'countdown'
  | 'playing'
  | 'awaiting_results'
  | 'finished'
  | 'cancelled'

export interface DuelRules {
  country: CountryCode
  levelId: string
}

export interface DuelProfile {
  user_id: string
  username: string
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
        /duel_profiles|duel_matches|duel_results|schema cache|does not exist|Could not find the table/i.test(
          message,
        )
      ) {
        return 'DUEL_SETUP_NEEDED'
      }
      return message
    }
  }
  if (err instanceof Error && err.message) return err.message
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
  const raw = typeof record.country === 'string' ? record.country.toUpperCase() : 'VE'
  const country = (raw === 'ES' || raw === 'EU' ? raw : 'VE') as CountryCode
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
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    draws: Number(row.draws) || 0,
    updated_at: String(row.updated_at),
  }
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

export async function claimUsername(user: User, username: string): Promise<DuelProfile> {
  const supabase = requireClient()
  const clean = normalizeUsername(username)
  if (!isValidUsername(clean)) {
    throw new Error('Invalid username')
  }
  const { data, error } = await supabase
    .from('duel_profiles')
    .upsert(
      {
        user_id: user.id,
        username: clean,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('USERNAME_TAKEN')
    throw new Error(duelErrorMessage(error, error.message || 'Duel error'))
  }
  return mapProfile(data as Record<string, unknown>)
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
    .eq('status', 'lobby')
  if (error) throw error
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
  const { error: insertError } = await supabase.from('duel_results').insert({
    match_id: matchId,
    user_id: userId,
    completed: input.completed,
    forfeited: Boolean(input.forfeited),
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    mistakes: Math.max(0, input.mistakes),
    stars: Math.min(3, Math.max(0, input.stars)),
  })
  if (insertError && insertError.code !== '23505') throw insertError

  const { data, error } = await supabase.rpc('resolve_duel', {
    p_match_id: matchId,
  })
  if (error) throw error
  return mapMatch(data as Record<string, unknown>)
}

export async function rematchDuel(matchId: string): Promise<DuelMatch> {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('rematch_duel', {
    p_match_id: matchId,
  })
  if (error) throw error
  return mapMatch(data as Record<string, unknown>)
}

export async function leaveDuel(matchId: string): Promise<DuelMatch> {
  const supabase = requireClient()
  const { data, error } = await supabase.rpc('leave_duel', {
    p_match_id: matchId,
  })
  if (error) throw error
  return mapMatch(data as Record<string, unknown>)
}

const ROOM_STORAGE_KEY = 'mh-duel-room'
const INVITE_STORAGE_KEY = 'mh-duel-invite'

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
    sessionStorage.setItem(INVITE_STORAGE_KEY, clean)
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
    return sessionStorage.getItem(INVITE_STORAGE_KEY)
  } catch {
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
