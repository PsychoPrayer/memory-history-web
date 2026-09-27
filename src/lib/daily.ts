import { useMemo } from 'react'
import type { Achievement, CountryCode, Level, Stars } from '../types'
import { computeStars } from '../data/progression'
import type { MatchRules } from './useMatch'
import { useSave, type DailyData, type DailyResult } from './save'
import type { useT } from './i18n'

/**
 * Daily challenge: one board per UTC day and country, identical for every
 * player. Only the first attempt counts; every mistake adds a time penalty.
 */

export const PENALTY_SECONDS = 3

/** Board size by UTC weekday (Sunday first): easy start of week, hard weekend. */
const CARDS_BY_WEEKDAY = [28, 12, 16, 16, 20, 20, 24] as const

/** Streak lengths that grant extra avatars on top of one per day played. */
export const STREAK_BONUSES = [
  { days: 3, avatars: 1 },
  { days: 7, avatars: 2 },
  { days: 14, avatars: 3 },
  { days: 30, avatars: 5 },
] as const

export function dailyKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10)
}

export function resultKey(day: string, country: CountryCode): string {
  return `${day}|${country}`
}

export function dayFromKey(day: string): Date {
  return new Date(`${day}T00:00:00Z`)
}

export function shiftDay(day: string, delta: number): string {
  const date = dayFromKey(day)
  date.setUTCDate(date.getUTCDate() + delta)
  return dailyKey(date)
}

export function dailyCards(day: string): number {
  return CARDS_BY_WEEKDAY[dayFromKey(day).getUTCDay()]
}

/** FNV-1a: stable seed from the day + country so every player gets the same board. */
export function dailySeed(day: string, country: CountryCode): number {
  let hash = 0x811c9dc5
  for (const char of `${day}:${country}:memory-history`) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** Borrows layout, peek and star thresholds from the campaign's normal level of that size. */
export function dailyRules(day: string, levels: Level[]): MatchRules {
  const cards = dailyCards(day)
  const template =
    levels.find((level) => level.cartas === cards && !level.dificil) ??
    levels.find((level) => level.cartas === cards)
  return {
    cards,
    columns: template?.columnas ?? 4,
    rows: template?.filas ?? cards / 4,
    seconds: 0,
    peekSeconds: template?.vistazoSeg || 3,
    mistakes: template?.errores ?? { tres: 2, dos: 5, una: 9 },
    back: template?.reverso ?? null,
    hard: false,
  }
}

export function dailyScore(seconds: number, mistakes: number): number {
  return seconds + mistakes * PENALTY_SECONDS
}

export function dailyStars(mistakes: number, rules: MatchRules): Stars {
  return computeStars(mistakes, rules.mistakes)
}

export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next.getTime() - now.getTime()
}

export interface DailyStats {
  /** Distinct UTC days with at least one completed official challenge. */
  daysPlayed: number
  currentStreak: number
  bestStreak: number
  /** Best stamp per day, for the passport. */
  stampByDay: Map<string, Stars>
}

export function computeDailyStats(daily: DailyData, today: string = dailyKey()): DailyStats {
  const stampByDay = new Map<string, Stars>()
  for (const result of Object.values(daily.results)) {
    const previous = stampByDay.get(result.day) ?? 0
    stampByDay.set(result.day, Math.max(previous, result.stars) as Stars)
  }

  const days = [...stampByDay.keys()].sort()
  let bestStreak = 0
  let run = 0
  let previous: string | null = null
  for (const day of days) {
    run = previous && shiftDay(previous, 1) === day ? run + 1 : 1
    bestStreak = Math.max(bestStreak, run)
    previous = day
  }

  /* Today's streak survives until the day ends: count back from today, or from yesterday. */
  let cursor = stampByDay.has(today) ? today : shiftDay(today, -1)
  let currentStreak = 0
  while (stampByDay.has(cursor)) {
    currentStreak += 1
    cursor = shiftDay(cursor, -1)
  }

  return { daysPlayed: days.length, currentStreak, bestStreak, stampByDay }
}

/** Prize avatars earned: one per day played plus streak bonuses. */
export function prizeAvatarsEarned(stats: Pick<DailyStats, 'daysPlayed' | 'bestStreak'>): number {
  let earned = stats.daysPlayed
  for (const bonus of STREAK_BONUSES) {
    if (stats.bestStreak >= bonus.days) earned += bonus.avatars
  }
  return earned
}

export function streakLabel(t: ReturnType<typeof useT>, days: number): string {
  return days === 1 ? t('dailyStreakOne') : t('dailyStreakDays', { n: days })
}

export function nextStreakBonus(bestStreak: number) {
  return STREAK_BONUSES.find((bonus) => bestStreak < bonus.days) ?? null
}

export function useDailyStats(): DailyStats {
  const daily = useSave((state) => state.daily)
  const today = dailyKey()
  return useMemo(() => computeDailyStats(daily, today), [daily, today])
}

export function todayResult(
  daily: DailyData,
  country: CountryCode,
  day: string = dailyKey(),
): DailyResult | undefined {
  return daily.results[resultKey(day, country)]
}

/** Challenge achievements, shared by every country. */
export const DAILY_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_daily_days_1',
    es: { titulo: 'Primer sello', descripcion: 'Completa tu primer desafío del día' },
    en: { titulo: 'First stamp', descripcion: 'Complete your first daily challenge' },
    tipo: 90,
    objetivo: 1,
    conProgreso: false,
    icono: null,
  },
  {
    id: 'ach_daily_streak_3',
    es: { titulo: 'Constante', descripcion: 'Consigue una racha de 3 días en el desafío' },
    en: { titulo: 'Steady', descripcion: 'Reach a 3-day daily challenge streak' },
    tipo: 90,
    objetivo: 3,
    conProgreso: true,
    icono: null,
  },
  {
    id: 'ach_daily_streak_7',
    es: { titulo: 'Semana completa', descripcion: 'Consigue una racha de 7 días en el desafío' },
    en: { titulo: 'Full week', descripcion: 'Reach a 7-day daily challenge streak' },
    tipo: 90,
    objetivo: 7,
    conProgreso: true,
    icono: null,
  },
  {
    id: 'ach_daily_streak_30',
    es: { titulo: 'Explorador incansable', descripcion: 'Consigue una racha de 30 días en el desafío' },
    en: { titulo: 'Tireless explorer', descripcion: 'Reach a 30-day daily challenge streak' },
    tipo: 90,
    objetivo: 30,
    conProgreso: true,
    icono: null,
  },
  {
    id: 'ach_daily_days_30',
    es: { titulo: 'Pasaporte lleno', descripcion: 'Completa 30 desafíos del día' },
    en: { titulo: 'Full passport', descripcion: 'Complete 30 daily challenges' },
    tipo: 90,
    objetivo: 30,
    conProgreso: true,
    icono: null,
  },
]
