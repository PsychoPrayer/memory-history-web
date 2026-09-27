import { useState } from 'react'
import { Modal } from './Modal'
import { openDonate, isDonateConfigured } from '../lib/donate'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

interface Props {
  /** `link` is the menu footer control; `button` is a full secondary control. */
  variant?: 'link' | 'button'
  className?: string
}

/** Coffee-cup mark for the donate control. */
function CupIcon() {
  return (
    <svg className="donate-cup" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4 9h12v5.5A4.5 4.5 0 0 1 11.5 19h-3A4.5 4.5 0 0 1 4 14.5V9z"
        fill="currentColor"
      />
      <path
        d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 3.5c.8.9.8 2.1 0 3M11.5 3.5c.8.9.8 2.1 0 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M3 21h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Always visible. Opens a short note first; the Ko-fi link appears once
 * VITE_KOFI_URL is set, and until then the note says it is coming soon.
 */
export function DonateButton({ variant = 'link', className = '' }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ready = isDonateConfigured()

  const trigger = () => {
    playSound('button')
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={
          variant === 'button'
            ? `btn-secondary donate-button ${className}`.trim()
            : `donate-link ${className}`.trim()
        }
        onClick={trigger}
        title={t('donateHelp')}
      >
        <CupIcon />
        {t('donateCta')}
      </button>

      <Modal open={open} onClose={() => setOpen(false)}>
        <div className="donate-modal">
          <span className="donate-modal-cup" aria-hidden="true">
            <CupIcon />
          </span>
          <h2 className="modal-title">{t('donateTitle')}</h2>
          <p className="modal-text">{t('donateBlurb')}</p>
          {!ready && <p className="modal-text-muted">{t('donateSoon')}</p>}
          <div className="modal-actions">
            {ready && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  playSound('button')
                  openDonate()
                  setOpen(false)
                }}
              >
                {t('donateGo')}
              </button>
            )}
            <button
              type="button"
              className={ready ? 'btn-secondary' : 'btn-primary'}
              onClick={() => setOpen(false)}
            >
              {t('close')}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
