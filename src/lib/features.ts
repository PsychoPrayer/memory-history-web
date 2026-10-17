/**
 * Features that are built but parked until the game is more solid. Turning one
 * back on is a one-word change here; everything it needs is still in the repo.
 *
 * - duels: real-time duels between players (Duel screen, supabase/duel*.sql).
 * - daily: the daily challenge, its leaderboard, streak achievements and the
 *   prize avatars it unlocks (Daily screens, supabase/daily.sql).
 */
export const FEATURES = {
  duels: false,
  daily: false,
} as const
