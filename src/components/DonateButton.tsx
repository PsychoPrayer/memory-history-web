import { openDonate, isDonateConfigured } from '../lib/donate'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

interface Props {
  /** `link` matches menu footer; `button` is a full secondary control. */
  variant?: 'link' | 'button'
  className?: string
}

export function DonateButton({ variant = 'link', className = '' }: Props) {
  const t = useT()
  const ready = isDonateConfigured()

  if (!ready) return null

  const onClick = () => {
    playSound('button')
    openDonate()
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        className={`btn-secondary ${className}`.trim()}
        onClick={onClick}
      >
        {t('donate')}
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`link-subtle link-donate ${className}`.trim()}
      onClick={onClick}
      title={t('donateHelp')}
    >
      {t('donate')}
    </button>
  )
}
