/**
 * Duel race score: one number so time and mistakes are comparable.
 *
 * score = max(0, BASE − seconds×PER_SECOND − mistakes×PER_MISTAKE)
 *
 * With PER_MISTAKE = 150 and PER_SECOND = 10, one mistake equals 15 seconds.
 * Example: 3s faster but +1 mistake loses (you “owe” 12s of score).
 */

export const DUEL_SCORE_BASE = 10_000
export const DUEL_SCORE_PER_SECOND = 10
export const DUEL_SCORE_PER_MISTAKE = 150

/** Seconds of race time that equal one mistake. */
export const DUEL_MISTAKE_EQUALS_SECONDS =
  DUEL_SCORE_PER_MISTAKE / DUEL_SCORE_PER_SECOND

export interface DuelScoreInput {
  completed: boolean
  forfeited?: boolean
  durationMs: number
  mistakes: number
}

export interface DuelScoreBreakdown {
  /** Final score used to rank; 0 if incomplete or forfeited. */
  total: number
  timePenalty: number
  mistakePenalty: number
  seconds: number
  eligible: boolean
}

export function duelScoreBreakdown(input: DuelScoreInput): DuelScoreBreakdown {
  const seconds = Math.max(0, Math.floor(input.durationMs / 1000))
  const mistakes = Math.max(0, Math.floor(input.mistakes))
  const timePenalty = seconds * DUEL_SCORE_PER_SECOND
  const mistakePenalty = mistakes * DUEL_SCORE_PER_MISTAKE
  const eligible = Boolean(input.completed) && !input.forfeited

  if (!eligible) {
    return {
      total: 0,
      timePenalty,
      mistakePenalty,
      seconds,
      eligible: false,
    }
  }

  return {
    total: Math.max(0, DUEL_SCORE_BASE - timePenalty - mistakePenalty),
    timePenalty,
    mistakePenalty,
    seconds,
    eligible: true,
  }
}

export function computeDuelScore(input: DuelScoreInput): number {
  return duelScoreBreakdown(input).total
}
