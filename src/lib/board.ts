import type { CardCatalog, BoardTile } from '../types'

export type RandomFn = () => number

/** Deterministic PRNG (Mulberry32) for shared duel boards. */
export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/**
 * Builds the board deck.
 *
 * Same as Unity: the pool is cards whose minimum board size does not exceed
 * the level size — larger boards inherit all smaller cards and add their own.
 * Pass `seed` so both duelists get the identical layout.
 */
export function buildBoard(
  catalog: CardCatalog[],
  cardCount: number,
  seed?: number,
): BoardTile[] {
  const pairs = cardCount / 2
  const pool = catalog.filter((card) => card.desbloqueoEn <= cardCount)
  /* Sort so seeded duels are identical even if catalog load order differs. */
  const available = [...(pool.length ? pool : catalog)].sort((a, b) =>
    a.id.localeCompare(b.id),
  )
  const random = seed != null ? mulberry32(seed) : Math.random

  const picked = shuffle(available, random).slice(0, pairs)
  const tiles = picked.flatMap<BoardTile>((card) => [
    { key: `${card.id}-a`, card, state: 'hidden' },
    { key: `${card.id}-b`, card, state: 'hidden' },
  ])

  return shuffle(tiles, random)
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}

/**
 * Keep matched tiles in place; reshuffle and hide the rest (hard-mode fog).
 */
export function reshuffleUnmatched(tiles: BoardTile[]): BoardTile[] {
  const unmatched = shuffle(
    tiles
      .filter((tile) => tile.state !== 'matched')
      .map((tile) => ({ ...tile, state: 'hidden' as const })),
  )
  let index = 0
  return tiles.map((tile) =>
    tile.state === 'matched' ? tile : unmatched[index++]!,
  )
}
