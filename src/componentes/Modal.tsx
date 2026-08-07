import { useEffect, type ReactNode } from 'react'

interface Props {
  abierto: boolean
  /** Cuando falta, el modal no se puede cerrar desde fuera. */
  onCerrar?: () => void
  ancho?: 'normal' | 'ancho'
  children: ReactNode
}

export function Modal({ abierto, onCerrar, ancho = 'normal', children }: Props) {
  useEffect(() => {
    if (!abierto || !onCerrar) return
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="velo" onClick={onCerrar ? () => onCerrar() : undefined}>
      <div
        className="modal"
        data-ancho={ancho}
        role="dialog"
        aria-modal="true"
        onClick={(evento) => evento.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
