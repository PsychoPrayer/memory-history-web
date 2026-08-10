import type { CSSProperties, KeyboardEvent } from 'react'
import type { BoardTile } from '../types'
import { useT } from '../lib/i18n'

interface Props {
  tile: BoardTile
  index: number
  total: number
  columns: number
  revealed: boolean
  back: string | null
  tabIndex: number
  onFlip: (key: string) => void
  onFocusIndex: (index: number) => void
  onArrow: (index: number, key: string) => void
}

function hueFrom(id: string): number {
  let acc = 0
  for (let i = 0; i < id.length; i += 1) acc = (acc * 31 + id.charCodeAt(i)) % 360
  return acc
}

export function Card({
  tile,
  index,
  total,
  columns,
  revealed,
  back,
  tabIndex,
  onFlip,
  onFocusIndex,
  onArrow,
}: Props) {
  const t = useT()
  const { card, state } = tile
  const faceUp = revealed || state !== 'hidden' ? 'up' : 'down'

  const position = t('cardOf', { n: index + 1, total })
  const faceLabel =
    faceUp === 'up'
      ? state === 'matched'
        ? `${card.nombre}. ${t('matchedMark')}`
        : state === 'failed'
          ? `${card.nombre}. ${t('missedMark')}`
          : state === 'hinted'
            ? `${card.nombre}. ${t('hintMark')}`
            : card.nombre
      : t('faceDownCard')
  const label = `${position}. ${faceLabel}`

  const style = {
    '--i': index,
    '--hue': hueFrom(card.id),
    '--back': back ? `url(${JSON.stringify(back)})` : undefined,
  } as CSSProperties

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      event.preventDefault()
      onArrow(index, event.key)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (state !== 'matched') onFlip(tile.key)
    }
  }

  return (
    <button
      type="button"
      className="card"
      style={style}
      role="gridcell"
      aria-colindex={(index % columns) + 1}
      aria-rowindex={Math.floor(index / columns) + 1}
      data-face={faceUp}
      data-state={state}
      aria-disabled={state === 'matched' || undefined}
      tabIndex={tabIndex}
      aria-label={label}
      aria-pressed={faceUp === 'up'}
      onFocus={() => onFocusIndex(index)}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (state !== 'matched') onFlip(tile.key)
      }}
    >
      <span className="card-shake">
        <span className="card-flip">
          <span
            className="card-face card-back"
            data-has-image={back !== null}
            aria-hidden="true"
          >
            <span className="back-emblem" />
          </span>
          <span className="card-face card-front">
            {card.imagen ? (
              <img className="card-image" src={card.imagen} alt="" loading="lazy" />
            ) : (
              <span className="card-initial">{card.nombre.slice(0, 2)}</span>
            )}
            {state === 'matched' && (
              <span className="card-mark" data-kind="match" aria-hidden="true">
                ✓
              </span>
            )}
            {state === 'failed' && (
              <span className="card-mark" data-kind="miss" aria-hidden="true">
                ✕
              </span>
            )}
            {state === 'hinted' && (
              <span className="card-mark" data-kind="hint" aria-hidden="true">
                ?
              </span>
            )}
          </span>
        </span>
      </span>
    </button>
  )
}
