import { syncMuteToMusic, unlockAudio } from '../lib/audio'
import { setSetting, useSave } from '../lib/save'
import { useT } from '../lib/i18n'

interface Props {
  className?: string
  /** Compact icon-only control for the menu header. */
  compact?: boolean
}

/** Toggles global mute (music + effects). Keeps slider volumes unchanged. */
export function MuteButton({ className = '', compact = false }: Props) {
  const t = useT()
  const muted = useSave((state) => Boolean(state.settings.muted))

  return (
    <button
      type="button"
      className={`mute-button ${compact ? 'mute-button-compact' : ''} ${className}`.trim()}
      aria-pressed={muted}
      aria-label={muted ? t('unmute') : t('mute')}
      title={muted ? t('unmute') : t('mute')}
      onClick={() => {
        unlockAudio()
        const next = !muted
        setSetting('muted', next)
        syncMuteToMusic()
      }}
    >
      <svg className="mute-button-icon" viewBox="0 0 24 24" aria-hidden="true">
        {muted ? (
          <>
            <path
              d="M4 9v6h3.5L12 19V5L7.5 9H4z"
              fill="currentColor"
            />
            <path
              d="M15.5 9.5l5 5m0-5l-5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <path
              d="M4 9v6h3.5L12 19V5L7.5 9H4z"
              fill="currentColor"
            />
            <path
              d="M15.5 8.5a4.5 4.5 0 0 1 0 7M17.5 6a8 8 0 0 1 0 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {!compact && (
        <span className="mute-button-label">
          {muted ? t('unmute') : t('mute')}
        </span>
      )}
    </button>
  )
}
