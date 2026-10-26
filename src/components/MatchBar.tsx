import { useId, type CSSProperties } from 'react'
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
  /** The free hint is spent but a rewarded ad can give another one. */
  hintRefill?: boolean
}

/** Lit glass bulb on a brass screw base; goes dark once the hint is spent. */
function HintBulbIcon({ lit }: { lit: boolean }) {
  const id = useId().replace(/:/g, '')
  const glass = `${id}-glass`
  const brass = `${id}-brass`
  const halo = `${id}-halo`

  return (
    <svg
      className="match-bar-hint-icon"
      viewBox="0 0 48 48"
      data-lit={lit}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glass} cx="0.42" cy="0.36" r="0.7">
          {lit ? (
            <>
              <stop offset="0" stopColor="#fffdf0" />
              <stop offset="0.35" stopColor="#ffe89a" />
              <stop offset="0.75" stopColor="#f2b93b" />
              <stop offset="1" stopColor="#c07d12" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#f3eee2" />
              <stop offset="0.6" stopColor="#cfc6b3" />
              <stop offset="1" stopColor="#9a907c" />
            </>
          )}
        </radialGradient>
        <linearGradient id={brass} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5514" />
          <stop offset="0.3" stopColor="#f4d98b" />
          <stop offset="0.55" stopColor="#c9962e" />
          <stop offset="1" stopColor="#6a4810" />
        </linearGradient>
        <radialGradient id={halo}>
          <stop offset="0" stopColor="#ffe28a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffe28a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {lit && (
        <>
          <circle className="hint-halo" cx="24" cy="18" r="17" fill={`url(#${halo})`} />
          <g className="hint-rays" stroke="#b07a14" strokeWidth="2" strokeLinecap="round">
            <path d="M24 1.5v3" />
            <path d="M9.5 7.5l2.2 2.2" />
            <path d="M38.5 7.5l-2.2 2.2" />
            <path d="M3.5 19h3" />
            <path d="M41.5 19h3" />
          </g>
        </>
      )}

      <path
        d="M18 31c0-3.6-6-6-6-12.6a12 12 0 0 1 24 0C36 25 30 27.4 30 31z"
        fill={`url(#${glass})`}
        stroke={lit ? '#9a6412' : '#7c725f'}
        strokeWidth="1.2"
      />
      <path
        d="M20.5 30.5v-6.2l1.8-3 1.7 3 1.7-3 1.8 3v6.2"
        fill="none"
        stroke={lit ? '#a2560a' : '#6f6656'}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <ellipse
        cx="18.6"
        cy="14"
        rx="2.6"
        ry="4.6"
        transform="rotate(28 18.6 14)"
        fill="#fff"
        opacity={lit ? 0.75 : 0.55}
      />

      <rect x="17" y="30.5" width="14" height="3.4" rx="1" fill={`url(#${brass})`} />
      <rect x="17.8" y="34.2" width="12.4" height="2.6" rx="1.3" fill={`url(#${brass})`} />
      <rect x="17.8" y="37.1" width="12.4" height="2.6" rx="1.3" fill={`url(#${brass})`} />
      <path d="M20.5 40h7l-1.6 3.2h-3.8z" fill="#3a2a1a" />
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
  hintRefill = false,
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
            data-refill={hintRefill || undefined}
            title={hintRefill ? t('adHintTitle') : t('hintHelp')}
            aria-label={
              hintRefill
                ? t('adHintTitle')
                : hintUsed
                  ? t('hintUsed')
                  : `${t('hintAsk')}. ${t('hintHelp')}`
            }
            onClick={onHint}
          >
            <HintBulbIcon lit={!hintUsed && !hintRefill && !hintDisabled} />
            {hintRefill && <span className="match-bar-hint-refill" aria-hidden="true">▶</span>}
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
