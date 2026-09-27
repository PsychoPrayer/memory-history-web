import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { PancitoSprite, type PancitoPose } from './PancitoGuide'
import { useT, type TextKey } from '../lib/i18n'

const TIP_KEYS: TextKey[] = [
  'loadingTip1',
  'loadingTip2',
  'loadingTip3',
  'loadingTip4',
  'loadingTip5',
  'loadingTip6',
  'loadingTip7',
  'loadingTip8',
]

const POSES: PancitoPose[] = ['guide', 'point', 'happy', 'wait']

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

interface Props {
  /** What is "loading": shown as the title. */
  label: TextKey
  children: ReactNode
}

/**
 * A short staged loading screen before a board or map appears. The content
 * is ready instantly; the pause builds a little anticipation. Children mount
 * only afterwards, so match timers never start behind the curtain.
 */
export function LoadingGate({ label, children }: Props) {
  const t = useT()
  const [duration] = useState(() =>
    prefersReducedMotion() ? 450 : 1300 + Math.round(Math.random() * 600),
  )
  const [done, setDone] = useState(false)
  const tip = useMemo(() => TIP_KEYS[Math.floor(Math.random() * TIP_KEYS.length)]!, [])
  const pose = useMemo(() => POSES[Math.floor(Math.random() * POSES.length)]!, [])

  useEffect(() => {
    const id = window.setTimeout(() => setDone(true), duration)
    return () => clearTimeout(id)
  }, [duration])

  if (done) return <>{children}</>

  return (
    <div
      className="loading-gate"
      role="status"
      aria-live="polite"
      style={{ '--loading-ms': `${duration}ms` } as CSSProperties}
    >
      <div className="loading-card">
        <PancitoSprite pose={pose} className="loading-pancito" />
        <p className="loading-title">{t(label)}</p>
        <div className="loading-track" aria-hidden="true">
          <span className="loading-fill" />
        </div>
        <p className="loading-tip">
          <span className="loading-tip-label">{t('loadingDidYouKnow')}</span>
          {t(tip)}
        </p>
      </div>
    </div>
  )
}
