import type { CSSProperties } from 'react'
import { formatearTiempo } from '../lib/tablero'
import { useTexto } from '../lib/i18n'

interface Props {
  titulo: string
  restante: number
  transcurrido: number
  sinLimite: boolean
  limite: number
  errores: number
  parejasHechas: number
  totalParejas: number
  onPausar: () => void
}

export function BarraPartida({
  titulo,
  restante,
  transcurrido,
  sinLimite,
  limite,
  errores,
  parejasHechas,
  totalParejas,
  onPausar,
}: Props) {
  const t = useTexto()

  const fraccion = sinLimite ? 1 : Math.max(0, Math.min(1, restante / limite))
  const apremio = !sinLimite && fraccion <= 0.2

  return (
    <header className="barra">
      <button type="button" className="boton-fantasma barra-pausa" onClick={onPausar}>
        {t('pausa')}
      </button>

      <div className="barra-centro" data-apremio={apremio}>
        <div className="cronometro">
          {formatearTiempo(sinLimite ? transcurrido : restante)}
        </div>
        {!sinLimite && (
          <div className="cronometro-riel">
            <div
              className="cronometro-pulso"
              style={{ '--fraccion': fraccion } as CSSProperties}
            />
          </div>
        )}
        <p className="barra-titulo">{titulo}</p>
      </div>

      <dl className="marcador">
        <div>
          <dt>{t('parejas')}</dt>
          <dd>
            {parejasHechas}
            <span>/{totalParejas}</span>
          </dd>
        </div>
        <div>
          <dt>{t('errores')}</dt>
          <dd data-tono="fallo">{errores}</dd>
        </div>
      </dl>
    </header>
  )
}
