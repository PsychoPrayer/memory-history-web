import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Cabecera } from '../componentes/Cabecera'
import { Modal } from '../componentes/Modal'
import { useContenido } from '../datos/contenido'
import { progresoDe, registrarTest, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { barajar } from '../lib/tablero'
import { useIdioma, useTexto } from '../lib/i18n'

const ESPERA_RESPUESTA = 950

export function Quiz() {
  const { nivel } = useParams()
  const navegar = useNavigate()
  const t = useTexto()
  const idioma = useIdioma()
  const { tests, preguntas } = useContenido()

  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  const test = tests.find((otro) => otro.nivel === Number(nivel))

  const [intento, setIntento] = useState(0)
  const [indice, setIndice] = useState(0)
  const [aciertos, setAciertos] = useState(0)
  const [elegida, setElegida] = useState<number | null>(null)
  const [terminado, setTerminado] = useState(false)
  const guardado = useRef(false)

  const tanda = useMemo(() => {
    if (!test) return []
    const delRango = preguntas.filter((pregunta) => {
      const numero = Number(pregunta.historia)
      return numero >= test.desdeHistoria && numero <= test.hastaHistoria
    })
    return barajar(delRango).slice(0, test.preguntas)
    // `intento` fuerza una tanda nueva al reintentar.
  }, [intento, preguntas, test])

  useEffect(() => {
    if (!test) navegar('/tests', { replace: true })
  }, [navegar, test])

  const nota = tanda.length
    ? Math.min(10, Math.max(1, Math.round((aciertos / tanda.length) * 10)))
    : 0

  useEffect(() => {
    if (!terminado || !test || guardado.current) return
    guardado.current = true
    registrarTest(pais, test.nivel, nota)
  }, [nota, pais, terminado, test])

  if (!test || tanda.length === 0) return null

  const pregunta = tanda[indice]
  const enunciado = pregunta[idioma].enunciado || pregunta.es.enunciado
  const opciones = pregunta[idioma].opciones.length
    ? pregunta[idioma].opciones
    : pregunta.es.opciones

  const responder = (opcion: number) => {
    if (elegida !== null) return
    setElegida(opcion)

    const acertada = opcion === pregunta.correcta
    if (acertada) setAciertos((valor) => valor + 1)
    sonar(acertada ? 'acierto' : 'fallo')

    window.setTimeout(() => {
      setElegida(null)
      if (indice + 1 < tanda.length) setIndice(indice + 1)
      else setTerminado(true)
    }, ESPERA_RESPUESTA)
  }

  const reintentar = () => {
    guardado.current = false
    setIntento((valor) => valor + 1)
    setIndice(0)
    setAciertos(0)
    setElegida(null)
    setTerminado(false)
  }

  return (
    <main className="pantalla pantalla-quiz">
      <Cabecera
        titulo={`${t('test')} ${test.nivel}`}
        volverA="/tests"
        derecha={
          <span className="cabecera-contador">
            {t('preguntaDe', { a: indice + 1, b: tanda.length })}
          </span>
        }
      />

      <article className="hoja-pregunta">
        <h2 className="pregunta-enunciado">{enunciado}</h2>

        <div className="lista-opciones">
          {opciones.map((opcion, posicion) => {
            const revelada = elegida !== null
            const esCorrecta = posicion === pregunta.correcta
            const estado = !revelada
              ? 'neutra'
              : esCorrecta
                ? 'correcta'
                : posicion === elegida
                  ? 'incorrecta'
                  : 'neutra'

            return (
              <button
                key={posicion}
                type="button"
                className="opcion"
                data-estado={estado}
                disabled={revelada}
                onClick={() => responder(posicion)}
              >
                <span className="opcion-letra">
                  {String.fromCharCode(65 + posicion)}
                </span>
                {opcion}
              </button>
            )
          })}
        </div>
      </article>

      <Modal abierto={terminado}>
        <h2 className="modal-titulo">{t('tuNota')}</h2>
        <p className="quiz-nota">{nota}<span>/10</span></p>
        <p className="modal-texto">{mensajeDeNota(nota, t)}</p>
        <p className="modal-texto modal-texto-tenue">
          {aciertos} / {tanda.length}
        </p>
        <div className="modal-acciones">
          <button type="button" className="boton-principal" onClick={reintentar}>
            {t('reintentar')}
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => navegar('/tests')}
          >
            {t('volver')}
          </button>
        </div>
        {progreso.tests[String(test.nivel)] && (
          <p className="modal-texto modal-texto-tenue">
            {t('testCompletado')}
          </p>
        )}
      </Modal>
    </main>
  )
}

function mensajeDeNota(nota: number, t: ReturnType<typeof useTexto>): string {
  if (nota === 10) return t('notaPerfecta')
  if (nota >= 7) return t('notaAlta')
  if (nota >= 4) return t('notaMedia')
  return t('notaBaja')
}
