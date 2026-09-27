import type { CountryCode } from '../types'
import { getCloudStatus } from './cloudSync'
import { getSupabase } from './supabase'
import type { DailyResult } from './save'

export interface LeaderboardRow {
  userId: string
  name: string
  avatarId: string | null
  seconds: number
  mistakes: number
  score: number
}

export interface Leaderboard {
  top: LeaderboardRow[]
  total: number
  /** 1-based rank of the signed-in player, when they have a result. */
  myRank: number | null
}

export type LeaderboardState =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ready'; board: Leaderboard }

const TOP_SIZE = 10

/** Sends the official result. A duplicate means it is already there, which is fine. */
export async function submitDailyResult(
  result: DailyResult,
  playerName: string,
  avatarId: string,
): Promise<boolean> {
  const supabase = getSupabase()
  const user = getCloudStatus().user
  if (!supabase || !user) return false

  const { error } = await supabase.from('daily_results').insert({
    user_id: user.id,
    day: result.day,
    country: result.country,
    cards: result.cards,
    seconds: Math.max(1, Math.round(result.seconds)),
    mistakes: result.mistakes,
    player_name: (playerName.trim() || 'Pancito').slice(0, 16),
    avatar_id: avatarId,
  })
  if (!error || error.code === '23505') return true
  console.warn('Daily result not submitted:', error.message)
  return false
}

export async function fetchLeaderboard(
  day: string,
  country: CountryCode,
): Promise<Leaderboard | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const [topQuery, countQuery] = await Promise.all([
    supabase
      .from('daily_results')
      .select('user_id, player_name, avatar_id, seconds, mistakes, score')
      .eq('day', day)
      .eq('country', country)
      .order('score', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(TOP_SIZE),
    supabase
      .from('daily_results')
      .select('user_id', { count: 'exact', head: true })
      .eq('day', day)
      .eq('country', country),
  ])
  if (topQuery.error || countQuery.error) return null

  const top: LeaderboardRow[] = (topQuery.data ?? []).map((row) => ({
    userId: row.user_id as string,
    name: row.player_name as string,
    avatarId: (row.avatar_id as string | null) ?? null,
    seconds: row.seconds as number,
    mistakes: row.mistakes as number,
    score: row.score as number,
  }))

  let myRank: number | null = null
  const user = getCloudStatus().user
  if (user) {
    const index = top.findIndex((row) => row.userId === user.id)
    if (index >= 0) {
      myRank = index + 1
    } else {
      const mine = await supabase
        .from('daily_results')
        .select('score')
        .eq('day', day)
        .eq('country', country)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!mine.error && mine.data) {
        const ahead = await supabase
          .from('daily_results')
          .select('user_id', { count: 'exact', head: true })
          .eq('day', day)
          .eq('country', country)
          .lt('score', mine.data.score as number)
        if (!ahead.error) myRank = (ahead.count ?? 0) + 1
      }
    }
  }

  return { top, total: countQuery.count ?? top.length, myRank }
}
