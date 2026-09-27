import type {
  CountryProgress,
  DailyData,
  FreeSettings,
  LevelRecord,
  SavedState,
  SettingsData,
  TestRecord,
} from './save'

function maxStars(a: number, b: number): LevelRecord['stars'] {
  return Math.max(a, b) as LevelRecord['stars']
}

function mergeLevel(a: LevelRecord | undefined, b: LevelRecord | undefined): LevelRecord | undefined {
  if (!a) return b
  if (!b) return a
  return {
    stars: maxStars(a.stars, b.stars),
    bestTime:
      a.bestTime > 0 && b.bestTime > 0
        ? Math.min(a.bestTime, b.bestTime)
        : Math.max(a.bestTime, b.bestTime),
    fewestMistakes: Math.min(a.fewestMistakes, b.fewestMistakes),
  }
}

function mergeTests(
  a: Record<string, TestRecord>,
  b: Record<string, TestRecord>,
): Record<string, TestRecord> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  const out: Record<string, TestRecord> = {}
  for (const key of keys) {
    const left = a[key]
    const right = b[key]
    if (!left) out[key] = right
    else if (!right) out[key] = left
    else {
      out[key] = {
        completed: left.completed || right.completed,
        bestScore: Math.max(left.bestScore, right.bestScore),
      }
    }
  }
  return out
}

function unionStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])]
}

function unionNumbers(a: number[], b: number[]): number[] {
  return [...new Set([...a, ...b])]
}

function mergeCountry(a: CountryProgress, b: CountryProgress): CountryProgress {
  const levelIds = new Set([
    ...Object.keys(a.levels),
    ...Object.keys(b.levels),
  ])
  const levels: Record<string, LevelRecord> = {}
  for (const id of levelIds) {
    const merged = mergeLevel(a.levels[id], b.levels[id])
    if (merged) levels[id] = merged
  }

  const achievementKeys = new Set([
    ...Object.keys(a.achievements),
    ...Object.keys(b.achievements),
  ])
  const achievements: Record<string, number> = {}
  for (const key of achievementKeys) {
    achievements[key] = Math.max(a.achievements[key] ?? 0, b.achievements[key] ?? 0)
  }

  return {
    levels,
    storiesRead: unionStrings(a.storiesRead, b.storiesRead),
    rewardsShown: unionStrings(a.rewardsShown, b.rewardsShown),
    sectionsCelebrated: unionNumbers(a.sectionsCelebrated, b.sectionsCelebrated),
    tests: mergeTests(a.tests, b.tests),
    achievements,
  }
}

function preferNewerSettings(a: SettingsData, b: SettingsData, aNewer: boolean): SettingsData {
  return aNewer ? { ...b, ...a } : { ...a, ...b }
}

function preferNewerFree(a: FreeSettings, b: FreeSettings, aNewer: boolean): FreeSettings {
  return aNewer ? a : b
}

/** Official daily results never change once recorded, so a union keeps both devices' days. */
function mergeDaily(a: DailyData | undefined, b: DailyData | undefined): DailyData {
  const left = a ?? { results: {}, started: [] }
  const right = b ?? { results: {}, started: [] }
  const results: DailyData['results'] = { ...right.results }
  for (const [key, result] of Object.entries(left.results)) {
    const other = results[key]
    results[key] = other
      ? { ...(result.submitted ? result : other), submitted: result.submitted || other.submitted }
      : result
  }
  return {
    results,
    started: unionStrings(left.started, right.started).sort().slice(-60),
  }
}

/** Merge two saves: progress takes the best of both; settings/free follow the newer stamp. */
export function mergeSavedStates(local: SavedState, remote: SavedState): SavedState {
  const localNewer = (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0)
  const countryCodes = new Set([
    ...Object.keys(local.countries),
    ...Object.keys(remote.countries),
  ])
  const countries: SavedState['countries'] = {}
  for (const code of countryCodes) {
    const left = local.countries[code]
    const right = remote.countries[code]
    if (!left) countries[code] = right
    else if (!right) countries[code] = left
    else countries[code] = mergeCountry(left, right)
  }

  return {
    version: Math.max(local.version, remote.version),
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0, Date.now()),
    settings: preferNewerSettings(local.settings, remote.settings, localNewer),
    free: preferNewerFree(local.free, remote.free, localNewer),
    countries,
    daily: mergeDaily(local.daily, remote.daily),
  }
}
