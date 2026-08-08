import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { BoardTile } from '../types'
import { useT } from '../lib/i18n'
import { Card } from './Card'

interface Props {
  tiles: BoardTile[]
  columns: number
  rows: number
  back: string | null
  revealing: boolean
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

export function Board({ tiles, columns, rows, back, revealing, onFlip }: Props) {
  const t = useT()
  const style = { '--columns': columns, '--rows': rows } as CSSProperties
  const orientation = rows > columns ? 'tall' : 'wide'
  const desktopWide = useDesktopWide()
  /** Matches CSS: tall boards flip columns/rows on wide screens. */
  const navColumns = orientation === 'tall' && desktopWide ? rows : columns
  const navRows = orientation === 'tall' && desktopWide ? columns : rows

  const [focusIndex, setFocusIndex] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusIndex >= tiles.length) setFocusIndex(0)
  }, [focusIndex, tiles.length])

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

  return (
    <div
      ref={gridRef}
      className="board"
      style={style}
      data-orientation={orientation}
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
  )
}
