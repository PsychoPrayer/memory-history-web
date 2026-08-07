import { useNavigate } from 'react-router-dom'
import { Cabecera } from '../componentes/Cabecera'
import {
  BARAJAS,
  NOMBRE_BARAJA,
  barajaDisponible,
  useReversos,
} from '../datos/contenido'
import { cambiarAjustesLibres, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { useTexto } from '../lib/i18n'
import { formatearTiempo } from '../lib/tablero'

const CARTAS = [12, 16, 20, 24, 28, 32, 40]
const TIEMPOS = [0, 60, 90, 120, 180, 300]

/**
 * PancitoLandia: partida suelta con las reglas que elija el jugador. Sin
 * estrellas, sin progreso y sin las mecánicas duras de la campaña.
 *
 * Las cuatro barajas aparecen siempre: VE, ES, EU y Pancitolandia. Las que
 * aún no se han exportado salen desactivadas en vez de desaparecer.
 */
export function Libre() {
  const t = useTexto()
  const navegar = useNavigate()
  const libre = useGuardado((estado) => estado.libre)
  const reversos = useReversos()

  return (
    <main className="pantalla pantalla-libre">
      <Cabecera titulo={t('libre')} />

      <section className="grupo-ajuste">
        <h2>{t('baraja')}</h2>
        <div className="fila-opciones">
          {BARAJAS.map((baraja) => {
            const lista = barajaDisponible(baraja)
            return (
              <button
                key={baraja}
                type="button"
                className="pestana"
                data-activa={libre.baraja === baraja}
                disabled={!lista}
                title={lista ? NOMBRE_BARAJA[baraja] : t('paisSinExportar')}
                onClick={() => {
                  sonar('boton')
                  cambiarAjustesLibres({ baraja })
                }}
              >
                {NOMBRE_BARAJA[baraja]}
              </button>
            )
          })}
        </div>
      </section>

      <section className="grupo-ajuste">
        <h2>{t('numeroDeCartas')}</h2>
        <div className="fila-opciones">
          {CARTAS.map((cartas) => (
            <button
              key={cartas}
              type="button"
              className="pestana"
              data-activa={libre.cartas === cartas}
              onClick={() => {
                sonar('boton')
                cambiarAjustesLibres({ cartas })
              }}
            >
              {cartas}
            </button>
          ))}
        </div>
      </section>

      <section className="grupo-ajuste">
        <h2>{t('limiteDeTiempo')}</h2>
        <div className="fila-opciones">
          {TIEMPOS.map((segundos) => (
            <button
              key={segundos}
              type="button"
              className="pestana"
              data-activa={libre.segundos === segundos}
              onClick={() => {
                sonar('boton')
                cambiarAjustesLibres({ segundos })
              }}
            >
              {segundos === 0 ? t('sinLimite') : formatearTiempo(segundos)}
            </button>
          ))}
        </div>
      </section>

      <section className="grupo-ajuste">
        <h2>{t('vistazoInicial')}</h2>
        <div className="fila-opciones">
          <button
            type="button"
            className="pestana"
            data-activa={libre.vistazo}
            onClick={() => cambiarAjustesLibres({ vistazo: true })}
          >
            {t('si')}
          </button>
          <button
            type="button"
            className="pestana"
            data-activa={!libre.vistazo}
            onClick={() => cambiarAjustesLibres({ vistazo: false })}
          >
            {t('no')}
          </button>
        </div>
      </section>

      {Object.keys(reversos).length > 0 && (
        <section className="grupo-ajuste">
          <h2>{t('reverso')}</h2>
          <div className="rejilla-reversos">
            <button
              type="button"
              className="ficha-reverso ficha-reverso-auto"
              data-activo={libre.reverso === null}
              onClick={() => {
                sonar('boton')
                cambiarAjustesLibres({ reverso: null })
              }}
            >
              {t('reversoDeLaSeccion')}
            </button>
            {Object.entries(reversos).map(([cartas, url]) => (
              <button
                key={cartas}
                type="button"
                className="ficha-reverso"
                data-activo={libre.reverso === url}
                onClick={() => {
                  sonar('boton')
                  cambiarAjustesLibres({ reverso: url })
                }}
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        className="boton-principal boton-ancho"
        disabled={!barajaDisponible(libre.baraja)}
        onClick={() => {
          sonar('transicion')
          navegar('/libre/partida')
        }}
      >
        {t('empezarPartida')}
      </button>
    </main>
  )
}
