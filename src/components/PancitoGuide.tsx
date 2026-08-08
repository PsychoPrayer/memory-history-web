import { markTipSeen, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT, type TextKey } from '../lib/i18n'

export const PANCITO_POSES = {
  happy: '/imagenes/ui/pancito/happy.webp',
  point: '/imagenes/ui/pancito/point.webp',
  wait: '/imagenes/ui/pancito/wait.webp',
  guide: '/imagenes/ui/pancito/guide.webp',
} as const

export type PancitoPose = keyof typeof PANCITO_POSES

interface PancitoSpriteProps {
  pose?: PancitoPose
  className?: string
}

export function PancitoSprite({ pose = 'happy', className = '' }: PancitoSpriteProps) {
  return (
    <img
      className={`pancito-sprite ${className}`.trim()}
      src={PANCITO_POSES[pose]}
      alt=""
      draggable={false}
    />
  )
}

interface PancitoTipProps {
  tipId: string
  textKey: TextKey
  pose?: PancitoPose
  className?: string
}

/** Dismissible tip bubble with Pancito. Shown once per tipId. */
export function PancitoTip({
  tipId,
  textKey,
  pose = 'happy',
  className = '',
}: PancitoTipProps) {
  const t = useT()
  const tipsSeen = useSave((state) => state.settings.tipsSeen ?? [])

  if (tipsSeen.includes(tipId)) return null

  return (
    <aside className={`pancito-tip ${className}`.trim()} role="status">
      <PancitoSprite pose={pose} className="pancito-tip-sprite" />
      <div className="pancito-tip-bubble">
        <p>{t(textKey)}</p>
        <button
          type="button"
          className="pancito-tip-dismiss"
          onClick={() => {
            playSound('button')
            markTipSeen(tipId)
          }}
        >
          {t('gotIt')}
        </button>
      </div>
    </aside>
  )
}

interface PancitoCalloutProps {
  tipId: string
  textKey: TextKey
  pose?: PancitoPose
  className?: string
}

/**
 * Compact Pancito line inside a modal. Shown once per tipId;
 * mark with markTipSeen when the parent advances.
 */
export function PancitoCallout({
  tipId,
  textKey,
  pose = 'happy',
  className = '',
}: PancitoCalloutProps) {
  const t = useT()
  const tipsSeen = useSave((state) => state.settings.tipsSeen ?? [])

  if (tipsSeen.includes(tipId)) return null

  return (
    <aside className={`pancito-callout ${className}`.trim()} role="status">
      <PancitoSprite pose={pose} className="pancito-callout-sprite" />
      <p>{t(textKey)}</p>
    </aside>
  )
}

/** Small “this way” cue next to the atlas next-mission marker. */
export function PancitoPointer({ className = '' }: { className?: string }) {
  const t = useT()

  return (
    <span className={`pancito-pointer ${className}`.trim()} aria-hidden="true">
      <PancitoSprite pose="point" />
      <span className="pancito-pointer-label">{t('thisWay')}</span>
    </span>
  )
}
