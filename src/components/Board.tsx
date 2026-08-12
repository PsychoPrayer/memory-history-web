import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { BoardTile } from '../types'
import { useT } from '../lib/i18n'
import type { FogPhase } from '../lib/useMatch'
import { Card } from './Card'

interface Props {
  tiles: BoardTile[]
  columns: number
  rows: number
  back: string | null
  revealing: boolean
  fogPhase?: FogPhase
  onFlip: (key: string) => void
}

function useDesktopWide() {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(min-width: 48rem)').matches
      : false,
  )

  useEffect(() => {
    const media = window.matchMedia('(min-width: 48rem)')
    const update = () => setWide(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return wide
}

/** Tighter gaps on bigger boards so cards can grow into free space. */
function gapRatioFor(cardCount: number): number {
  if (cardCount >= 32) return 0.05
  if (cardCount >= 20) return 0.06
  return 0.08
}

export function Board({
  tiles,
  columns,
  rows,
  back,
  revealing,
  fogPhase = null,
  onFlip,
}: Props) {
  const t = useT()
  /** Content grid shape: tall (more rows), wide (more columns), or square. */
  const orientation = rows > columns ? 'tall' : 'wide'
  const desktopWide = useDesktopWide()
  /*
   * Phone: landscape grids (8×4, 6×4…) flip to portrait so cards read vertically.
   * Desktop: tall grids flip to landscape to use the width (existing behavior).
   */
  const portraitOnPhone = !desktopWide && columns > rows
  const landscapeOnDesktop = desktopWide && rows > columns
  const navColumns = portraitOnPhone || landscapeOnDesktop ? rows : columns
  const navRows = portraitOnPhone || landscapeOnDesktop ? columns : rows
  const gapRatio = gapRatioFor(tiles.length)

  const [focusIndex, setFocusIndex] = useState(0)
  const [lado, setLado] = useState<number | null>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusIndex >= tiles.length) setFocusIndex(0)
  }, [focusIndex, tiles.length])

  useEffect(() => {
    const shell = shellRef.current
    if (!shell) return

    const measure = () => {
      const { width, height } = shell.getBoundingClientRect()
      if (width < 8 || height < 8) return
      const widthFactor = navColumns + (navColumns - 1) * gapRatio
      const heightFactor = navRows + (navRows - 1) * gapRatio
      /* Slight shrink so gaps never force page scroll on mobile Safari. */
      const next = Math.min(width / widthFactor, height / heightFactor) * 0.98
      const dpr = window.devicePixelRatio || 1
      const px = Math.max(
        22,
        Math.floor(next * dpr) / dpr,
      )
      setLado(px)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(shell)
    window.addEventListener('orientationchange', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('orientationchange', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [navColumns, navRows, gapRatio])

  const moveFocus = (from: number, key: string) => {
    const total = tiles.length
    if (total === 0) return

    let next = from
    if (key === 'Home') next = 0
    else if (key === 'End') next = total - 1
    else if (key === 'ArrowLeft') next = from - 1
    else if (key === 'ArrowRight') next = from + 1
    else if (key === 'ArrowUp') next = from - navColumns
    else if (key === 'ArrowDown') next = from + navColumns

    if (next < 0 || next >= total) return
    setFocusIndex(next)
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelectorAll<HTMLElement>('.card')
        [next]?.focus()
    })
  }

  const style = {
    '--columns': columns,
    '--rows': rows,
    '--gap-ratio': gapRatio,
    ...(lado != null ? { '--lado': `${lado}px` } : {}),
  } as CSSProperties

  return (
    <div
      className="board-shell"
      ref={shellRef}
      data-fog={fogPhase || undefined}
    >
      <div
        ref={gridRef}
        className="board"
        style={style}
        data-orientation={orientation}
        data-cards={tiles.length}
        data-fog={fogPhase || undefined}
        role="grid"
        aria-label={t('memoryBoard')}
        aria-rowcount={navRows}
        aria-colcount={navColumns}
      >
        {tiles.map((tile, index) => (
          <Card
            key={tile.key}
            tile={tile}
            index={index}
            total={tiles.length}
            columns={navColumns}
            revealed={revealing}
            back={back}
            tabIndex={index === focusIndex ? 0 : -1}
            onFlip={onFlip}
            onFocusIndex={setFocusIndex}
            onArrow={moveFocus}
          />
        ))}
      </div>
    </div>
  )
}
