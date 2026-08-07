import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { sonar } from '../lib/audio'

interface Props {
  titulo: string
  /** Ruta a la que vuelve la flecha. Por defecto, el menú. */
  volverA?: string
  derecha?: ReactNode
}

export function Cabecera({ titulo, volverA = '/menu', derecha }: Props) {
  const navegar = useNavigate()

  return (
    <header className="cabecera">
      <button
        type="button"
        className="boton-fantasma"
        onClick={() => {
          sonar('transicion')
          navegar(volverA)
        }}
        aria-label="Volver"
      >
        ←
      </button>
      <h1 className="cabecera-titulo">{titulo}</h1>
      <div className="cabecera-derecha">{derecha}</div>
    </header>
  )
}
