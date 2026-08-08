import type { CardCatalog, BoardTile } from '../types'

export function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Builds the board deck.
 *
 * Same as Unity: the pool is cards whose minimum board size does not exceed
 * the level size — larger boards inherit all smaller cards and add their own.
 */
export function buildBoard(catalog: CardCatalog[], cardCount: number): BoardTile[] {
  const pairs = cardCount / 2
  const pool = catalog.filter((card) => card.desbloqueoEn <= cardCount)
  const available = pool.length ? pool : catalog

  const picked = shuffle(available).slice(0, pairs)
  const tiles = picked.flatMap<BoardTile>((card) => [
    { key: `${card.id}-a`, card, state: 'hidden' },
    { key: `${card.id}-b`, card, state: 'hidden' },
  ])

  return shuffle(tiles)
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}
