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
  /** Compact hint control in the top bar (campaign / free play). */
  onHint?: () => void
  hintUsed?: boolean
  hintDisabled?: boolean
}

function HintBulbIcon() {
  return (
    <svg
      className="match-bar-hint-icon"
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M9 21h6v-1.5H9V21zm3-19a6 6 0 0 0-3.5 10.85c.55.42.9.97 1.05 1.55h4.9c.15-.58.5-1.13 1.05-1.55A6 6 0 0 0 12 2zm-1.7 11.4c-.22-.7-.6-1.32-1.15-1.75A4.5 4.5 0 1 1 16.85 11.65c-.55.43-.93 1.05-1.15 1.75H10.3z"
      />
    </svg>
  )
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
  onHint,
  hintUsed = false,
  hintDisabled = false,
}: Props) {
  const t = useT()

  const fraction = noLimit ? 1 : Math.max(0, Math.min(1, remaining / limit))
  const urgent = !noLimit && fraction <= 0.2
  const clock = formatTime(noLimit ? elapsed : remaining)

  return (
    <header className="match-bar">
      <div className="match-bar-left">
        <button
          type="button"
          className="btn-ghost match-bar-pause"
          onClick={onPause}
          aria-label={t('pause')}
        >
          {t('pause')}
        </button>
        {onHint && (
          <button
            type="button"
            className="match-bar-hint"
            disabled={hintDisabled || hintUsed}
            data-used={hintUsed || undefined}
            title={t('hintHelp')}
            aria-label={
              hintUsed ? t('hintUsed') : `${t('hintAsk')}. ${t('hintHelp')}`
            }
            onClick={onHint}
          >
            <HintBulbIcon />
          </button>
        )}
      </div>

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
