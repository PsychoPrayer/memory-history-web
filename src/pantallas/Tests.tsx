import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cabecera } from '../componentes/Cabecera'
import { useContenido } from '../datos/contenido'
import { historiasDesbloqueadas, motivoDeBloqueo } from '../datos/progresion'
import { progresoDe, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { useTexto } from '../lib/i18n'

export function Tests() {
  const t = useTexto()
  const navegar = useNavigate()
  const { tests, historias, niveles } = useContenido()

  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  const abiertas = useMemo(
    () => historiasDesbloqueadas(historias, niveles, progreso),
    [historias, niveles, progreso],
  )

  return (
    <main className="pantalla pantalla-tests">
      <Cabecera titulo={t('tests')} />

      <div className="lista-tests">
        {tests.map((test) => {
          // El original bloqueaba los tests 3, 4 y 5 con una bandera de
          // release aunque el progreso los tuviera abiertos. Aquí solo manda
          // el progreso.
          const motivo = motivoDeBloqueo(test, tests, abiertas, progreso)
          const abierto = motivo === null
          const marca = progreso.tests[String(test.nivel)]

          return (
            <button
              key={test.nivel}
              type="button"
              className="ficha-test"
              data-abierto={abierto}
              disabled={!abierto}
              onClick={() => {
                sonar('transicion')
                navegar(`/quiz/${test.nivel}`)
              }}
            >
              <span className="ficha-test-numero">{test.nivel}</span>
              <span className="ficha-test-cuerpo">
                <span className="ficha-test-nombre">
                  {t('test')} {test.nivel}
                </span>
                <span className="ficha-test-detalle">
                  {t('historias')} {test.desdeHistoria}–{test.hastaHistoria}
                </span>
                {motivo && (
                  <span className="ficha-test-aviso">
                    {motivo.tipo === 'testAnterior'
                      ? t('bloqueoTestAnterior', { n: motivo.nivel })
                      : motivo.desde === 1
                        ? t('bloqueoPrimerasHistorias', {
                            n: motivo.hasta,
                          })
                        : t('bloqueoHistorias', {
                            a: motivo.desde,
                            b: motivo.hasta,
                          })}
                  </span>
                )}
              </span>
              {marca?.completado && (
                <span className="ficha-test-nota">{marca.mejorNota}/10</span>
              )}
            </button>
          )
        })}
      </div>
    </main>
  )
}
