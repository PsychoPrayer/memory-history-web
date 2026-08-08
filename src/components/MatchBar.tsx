import type { CSSProperties } from 'react'
import { formatTime } from '../lib/board'
import { useT } from '../lib/i18n'

interface Props {
  title: string
  remaining: number
  elapsed: number
  noLimit: boolean
  limit: number
  mistakes: number
  pairsMade: number
  totalPairs: number
  onPause: () => void
}

export function MatchBar({
  title,
  remaining,
  elapsed,
  noLimit,
  limit,
  mistakes,
  pairsMade,
  totalPairs,
  onPause,
}: Props) {
  const t = useT()

  const fraction = noLimit ? 1 : Math.max(0, Math.min(1, remaining / limit))
  const urgent = !noLimit && fraction <= 0.2
  const clock = formatTime(noLimit ? elapsed : remaining)

  return (
    <header className="match-bar">
      <button
        type="button"
        className="btn-ghost match-bar-pause"
        onClick={onPause}
        aria-label={t('pause')}
      >
        {t('pause')}
      </button>

      <div className="match-bar-center" data-urgent={urgent}>
        <div
          className="timer"
          role="timer"
          aria-label={`${t('time')}: ${clock}`}
        >
          {clock}
        </div>
        {!noLimit && (
          <div className="timer-track" aria-hidden="true">
            <div
              className="timer-fill"
              style={{ '--fraction': fraction } as CSSProperties}
            />
          </div>
        )}
        <p className="match-bar-title">{title}</p>
      </div>

      <dl className="scoreboard">
        <div>
          <dt>{t('pairs')}</dt>
          <dd>
            {pairsMade}
            <span>/{totalPairs}</span>
          </dd>
        </div>
        <div>
          <dt>{t('mistakes')}</dt>
          <dd data-tone="miss">{mistakes}</dd>
        </div>
      </dl>
    </header>
  )
}
