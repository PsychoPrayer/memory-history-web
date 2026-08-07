import { useEffect } from 'react'
import { sonar } from '../lib/audio'
import { useTexto } from '../lib/i18n'

interface Props {
  src: string | null
  alt?: string
  onCerrar: () => void
}

/**
 * Vista a pantalla completa para apreciar el arte de una carta/historia.
 * Se cierra con Escape, clic en el fondo o el botón.
 */
export function VisorImagen({ src, alt = '', onCerrar }: Props) {
  const t = useTexto()

  useEffect(() => {
    if (!src) return
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [src, onCerrar])

  if (!src) return null

  return (
    <div
      className="visor"
      role="dialog"
      aria-modal="true"
      aria-label={t('verImagen')}
      onClick={onCerrar}
    >
      <button
        type="button"
        className="visor-cerrar"
        onClick={(evento) => {
          evento.stopPropagation()
          onCerrar()
        }}
      >
        {t('cerrar')}
      </button>
      <img
        className="visor-imagen"
        src={src}
        alt={alt}
        onClick={(evento) => evento.stopPropagation()}
      />
    </div>
  )
}

interface BotonLupaProps {
  onClick: () => void
}

/** Botón de lupa sobre una lámina; el clic no debe abrir el padre. */
export function BotonLupa({ onClick }: BotonLupaProps) {
  const t = useTexto()

  return (
    <button
      type="button"
      className="boton-lupa"
      aria-label={t('verImagen')}
      title={t('verImagen')}
      onClick={(evento) => {
        evento.stopPropagation()
        sonar('boton')
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
