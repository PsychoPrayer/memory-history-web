import type { CSSProperties } from 'react'
import type { FichaTablero } from '../tipos'

interface Props {
  ficha: FichaTablero
  indice: number
  revelada: boolean
  reverso: string | null
  onVoltear: (clave: string) => void
}

/**
 * Tono estable derivado del identificador. Sirve de fondo mientras la imagen
 * carga y de sustituto si una carta se quedó sin ilustración al exportar.
 */
function tonoDe(id: string): number {
  let acumulado = 0
  for (let i = 0; i < id.length; i += 1) acumulado = (acumulado * 31 + id.charCodeAt(i)) % 360
  return acumulado
}

export function Carta({ ficha, indice, revelada, reverso, onVoltear }: Props) {
  const { carta, estado } = ficha
  const boca = revelada || estado !== 'oculta' ? 'arriba' : 'abajo'

  const estilo = {
    '--i': indice,
    '--tono': tonoDe(carta.id),
    '--reverso': reverso ? `url(${JSON.stringify(reverso)})` : undefined,
  } as CSSProperties

  return (
    <button
      type="button"
      className="carta"
      style={estilo}
      data-boca={boca}
      data-estado={estado}
      disabled={estado === 'emparejada'}
      aria-label={boca === 'arriba' ? carta.nombre : 'Carta boca abajo'}
      onClick={() => onVoltear(ficha.clave)}
    >
      <span className="carta-sacudida">
        <span className="carta-giro">
          <span
            className="carta-cara carta-dorso"
            data-con-imagen={reverso !== null}
            aria-hidden="true"
          >
            <span className="dorso-emblema" />
          </span>
          <span className="carta-cara carta-frente">
            {carta.imagen ? (
              <img className="carta-imagen" src={carta.imagen} alt="" loading="lazy" />
            ) : (
              <span className="carta-inicial">{carta.nombre.slice(0, 2)}</span>
            )}
          </span>
        </span>
      </span>
    </button>
  )
}
