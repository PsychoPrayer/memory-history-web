import type { CountryProgress } from '../lib/save'
import type {
  Stars,
  Story,
  Achievement,
  Level,
  Test,
  ErrorThresholds,
} from '../types'

export interface Section {
  cards: number
  normal: Level[]
  hard: Level[]
}

export function sectionsFrom(levels: Level[]): Section[] {
  const byCards = new Map<number, Section>()

  for (const level of levels) {
    let section = byCards.get(level.cartas)
    if (!section) {
      section = { cards: level.cartas, normal: [], hard: [] }
      byCards.set(level.cartas, section)
    }
    ;(level.dificil ? section.hard : section.normal).push(level)
  }

  for (const section of byCards.values()) {
    section.normal.sort((a, b) => a.numero - b.numero)
    section.hard.sort((a, b) => a.numero - b.numero)
  }

  return [...byCards.values()].sort((a, b) => a.cards - b.cards)
}

export function starsFor(progress: CountryProgress, levelId: string): Stars {
  return progress.levels[levelId]?.stars ?? 0
}

export function isBeaten(progress: CountryProgress, levelId: string): boolean {
  return starsFor(progress, levelId) > 0
}

export function isUnlocked(
  level: Level,
  levels: Level[],
  progress: CountryProgress,
): boolean {
  if (level.abiertoPorDefecto) return true
  if (isBeaten(progress, level.id)) return true

  if (level.requisito) {
    return isBeaten(progress, level.requisito)
  }

  const previous = levels.find((other) => other.numero === level.numero - 1)
  if (!previous) return true
  return isBeaten(progress, previous.id)
}

export function computeStars(mistakes: number, thresholds: ErrorThresholds): Stars {
  if (mistakes <= thresholds.tres) return 3
  if (mistakes <= thresholds.dos) return 2
  if (mistakes <= thresholds.una) return 1
  return 0
}

export function totalStars(progress: CountryProgress): number {
  return Object.values(progress.levels).reduce((sum, record) => sum + record.stars, 0)
}

export function sectionComplete(section: Section, progress: CountryProgress): boolean {
  const all = [...section.normal, ...section.hard]
  return all.length > 0 && all.every((level) => isBeaten(progress, level.id))
}

/** First unlocked level not yet cleared; once all are cleared, the first without 3 stars. */
export function nextMissionId(levels: Level[], progress: CountryProgress): string | null {
  const ordered = [...levels].sort((a, b) => a.numero - b.numero)
  const pending = ordered.find(
    (level) => isUnlocked(level, levels, progress) && !isBeaten(progress, level.id),
  )
  if (pending) return pending.id
  return (
    ordered.find(
      (level) => isUnlocked(level, levels, progress) && starsFor(progress, level.id) < 3,
    )?.id ?? null
  )
}

export interface SectionStats {
  missionsDone: number
  missionsTotal: number
  stars: number
  starsTotal: number
}

export function sectionStats(section: Section, progress: CountryProgress): SectionStats {
  const all = [...section.normal, ...section.hard]
  let missionsDone = 0
  let stars = 0
  for (const level of all) {
    const earned = starsFor(progress, level.id)
    if (earned > 0) missionsDone += 1
    stars += earned
  }
  return {
    missionsDone,
    missionsTotal: all.length,
    stars,
    starsTotal: all.length * 3,
  }
}

/** Every level in the section has 3 stars. */
export function sectionPerfect(section: Section, progress: CountryProgress): boolean {
  const all = [...section.normal, ...section.hard]
  return all.length > 0 && all.every((level) => starsFor(progress, level.id) >= 3)
}

/** Every campaign level has 3 stars. */
export function campaignPerfect(levels: Level[], progress: CountryProgress): boolean {
  return levels.length > 0 && levels.every((level) => starsFor(progress, level.id) >= 3)
}

/** First section is always open; later ones need the previous section cleared. */
export function isSectionUnlocked(
  sectionIndex: number,
  sections: Section[],
  progress: CountryProgress,
): boolean {
  if (sectionIndex <= 0) return true
  const previous = sections[sectionIndex - 1]
  return previous ? sectionComplete(previous, progress) : true
}

export function unlockedStories(
  stories: Story[],
  levels: Level[],
  progress: CountryProgress,
): Set<string> {
  const open = new Set<string>()

  for (const level of levels) {
    if (level.historiaPremio && isBeaten(progress, level.id)) {
      open.add(level.historiaPremio)
    }
  }

  for (const story of stories) {
    if (story.abiertaPorDefecto) open.add(story.id)
    if (story.nivelDesbloqueo && isBeaten(progress, story.nivelDesbloqueo)) {
      open.add(story.id)
    }
  }

  return open
}

export type BlockReason =
  | { type: 'previousTest'; level: number }
  | { type: 'stories'; from: number; to: number }

export function blockReason(
  test: Test,
  tests: Test[],
  open: Set<string>,
  progress: CountryProgress,
): BlockReason | null {
  for (let n = test.desdeHistoria; n <= test.hastaHistoria; n += 1) {
    if (!open.has(String(n))) {
      return { type: 'stories', from: test.desdeHistoria, to: test.hastaHistoria }
    }
  }

  const previous = tests.find((other) => other.nivel === test.nivel - 1)
  if (previous && !progress.tests[String(previous.nivel)]?.completed) {
    return { type: 'previousTest', level: previous.nivel }
  }

  return null
}

export function testUnlocked(
  test: Test,
  tests: Test[],
  open: Set<string>,
  progress: CountryProgress,
): boolean {
  return blockReason(test, tests, open, progress) === null
}

export interface PlayerSummary {
  stars: number
  normalLevels: number
  hardLevels: number
  totalLevels: number
  perfectLevels: number
  storiesUnlocked: number
  storiesRead: number
  testsCompleted: number
  testsByLevel: Set<number>
  completedSections: Set<number>
  dailyDays: number
  dailyBestStreak: number
}

export function summarizePlayer(
  levels: Level[],
  stories: Story[],
  progress: CountryProgress,
  daily?: { daysPlayed: number; bestStreak: number },
): PlayerSummary {
  const open = unlockedStories(stories, levels, progress)

  let normalLevels = 0
  let hardLevels = 0
  let perfectLevels = 0

  for (const level of levels) {
    const stars = starsFor(progress, level.id)
    if (stars === 0) continue
    if (level.dificil) hardLevels += 1
    else normalLevels += 1
    if (stars === 3) perfectLevels += 1
  }

  const completedSections = new Set<number>()
  for (const section of sectionsFrom(levels)) {
    if (sectionComplete(section, progress)) completedSections.add(section.cards)
  }

  const testsByLevel = new Set<number>()
  for (const [key, record] of Object.entries(progress.tests)) {
    if (record.completed) testsByLevel.add(Number(key))
  }

  return {
    stars: totalStars(progress),
    normalLevels,
    hardLevels,
    totalLevels: normalLevels + hardLevels,
    perfectLevels,
    storiesUnlocked: open.size,
    storiesRead: progress.storiesRead.length,
    testsCompleted: testsByLevel.size,
    testsByLevel,
    completedSections,
    dailyDays: daily?.daysPlayed ?? 0,
    dailyBestStreak: daily?.bestStreak ?? 0,
  }
}

export function achievementProgress(
  achievement: Achievement,
  summary: PlayerSummary,
): number {
  const id = achievement.id

  if (id.startsWith('ach_daily_days_')) return summary.dailyDays
  if (id.startsWith('ach_daily_streak_')) return summary.dailyBestStreak

  if (id === 'ach_first_level') return Math.min(summary.totalLevels, 1)
  if (id === 'ach_perfect_level') return Math.min(summary.perfectLevels, 1)
  if (id === 'ach_first_story') return Math.min(summary.storiesRead, 1)
  if (id === 'ach_first_test') return Math.min(summary.testsCompleted, 1)
  if (id === 'ach_all_tests') return summary.testsCompleted

  const test = id.match(/^ach_test_(\d)$/)
  if (test) return summary.testsByLevel.has(Number(test[1])) ? 1 : 0

  const section = id.match(/^ach_section_(\d+)_cards$/)
  if (section) {
    /* Binary unlock; return objetivo so it works if content uses 1 or the card count. */
    return summary.completedSections.has(Number(section[1]))
      ? achievement.objetivo
      : 0
  }

  if (id.endsWith('_normal_levels')) return summary.normalLevels
  if (id.endsWith('_hard_levels')) return summary.hardLevels
  if (id.endsWith('_perfect_levels')) return summary.perfectLevels
  if (id.endsWith('_stories_unlock')) return summary.storiesUnlocked
  if (id.endsWith('_stories_read')) return summary.storiesRead
  if (id.endsWith('_stars')) return summary.stars
  if (id.endsWith('_levels')) return summary.totalLevels

  return 0
}

export function achievementEarned(achievement: Achievement, summary: PlayerSummary): boolean {
  return achievementProgress(achievement, summary) >= achievement.objetivo
}
