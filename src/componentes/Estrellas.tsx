import type { CSSProperties } from 'react'
import type { Estrellas as Cantidad } from '../tipos'

export const PUNTA_ESTRELLA =
  'M12 2.4l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z'

interface Props {
  cantidad: Cantidad
  /** `pip` es la versión reducida que llevan las fichas de los listados. */
  tamano?: 'grande' | 'pip'
}

export function Estrellas({ cantidad, tamano = 'grande' }: Props) {
  return (
    <div
      className="estrellas"
      data-tamano={tamano}
      role="img"
      aria-label={`${cantidad} de 3 estrellas`}
    >
      {[0, 1, 2].map((indice) => (
        <svg
          key={indice}
          className="estrella"
          data-ganada={indice < cantidad}
          style={{ '--i': indice } as CSSProperties}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d={PUNTA_ESTRELLA} />
        </svg>
      ))}
    </div>
  )
}
