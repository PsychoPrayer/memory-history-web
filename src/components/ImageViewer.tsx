import { useEffect } from 'react'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

interface Props {
  src: string | null
  alt?: string
  onClose: () => void
}

export function ImageViewer({ src, alt = '', onClose }: Props) {
  const t = useT()

  useEffect(() => {
    if (!src) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

  if (!src) return null

  return (
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={t('viewImage')}
      onClick={onClose}
    >
      <button
        type="button"
        className="viewer-close"
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
      >
        {t('close')}
      </button>
      <img
        className="viewer-image"
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}

interface ZoomButtonProps {
  onClick: () => void
}

export function ZoomButton({ onClick }: ZoomButtonProps) {
  const t = useT()

  return (
    <button
      type="button"
      className="zoom-button"
      aria-label={t('viewImage')}
      title={t('viewImage')}
      onClick={(event) => {
        event.stopPropagation()
        playSound('button')
        onClick()
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M15.5 15.5 L20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  )
}
