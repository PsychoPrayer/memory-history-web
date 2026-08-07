import type { CSSProperties } from 'react'
import type { FichaTablero } from '../tipos'
import { Carta } from './Carta'

interface Props {
  fichas: FichaTablero[]
  columnas: number
  filas: number
  reverso: string | null
  revelando: boolean
  onVoltear: (clave: string) => void
}

export function Tablero({ fichas, columnas, filas, reverso, revelando, onVoltear }: Props) {
  const estilo = { '--columnas': columnas, '--filas': filas } as CSSProperties
  // En PC ancha los tableros “altos” (p. ej. 4×6) se muestran a lo ancho
  // para ocupar los lados; en móvil se respeta la rejilla original.
  const orientacion = filas > columnas ? 'alta' : 'ancha'

  return (
    <div className="tablero" style={estilo} data-orientacion={orientacion}>
      {fichas.map((ficha, indice) => (
        <Carta
          key={ficha.clave}
          ficha={ficha}
          indice={indice}
          revelada={revelando}
          reverso={reverso}
          onVoltear={onVoltear}
        />
      ))}
    </div>
  )
}
