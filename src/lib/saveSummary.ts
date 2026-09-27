import type { SavedState } from './save'

/** Headline numbers used to compare two saves before choosing which to keep. */
export interface SaveSummary {
  stars: number
  levels: number
  storiesRead: number
  dailyDays: number
}

export function summarizeSave(state: SavedState): SaveSummary {
  let stars = 0
  let levels = 0
  let storiesRead = 0
  for (const progress of Object.values(state.countries ?? {})) {
    for (const record of Object.values(progress.levels ?? {})) {
      stars += record.stars
      if (record.stars > 0) levels += 1
    }
    storiesRead += progress.storiesRead?.length ?? 0
  }
  const days = new Set(Object.values(state.daily?.results ?? {}).map((result) => result.day))
  return { stars, levels, storiesRead, dailyDays: days.size }
}

export function hasProgress(summary: SaveSummary): boolean {
  return summary.levels > 0 || summary.storiesRead > 0 || summary.dailyDays > 0
}

export function sameSummary(a: SaveSummary, b: SaveSummary): boolean {
  return (
    a.stars === b.stars &&
    a.levels === b.levels &&
    a.storiesRead === b.storiesRead &&
    a.dailyDays === b.dailyDays
  )
}
