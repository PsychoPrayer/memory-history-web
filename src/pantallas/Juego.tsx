import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BarraPartida } from '../componentes/BarraPartida'
import { Estrellas } from '../componentes/Estrellas'
import { Modal } from '../componentes/Modal'
import { Tablero } from '../componentes/Tablero'
import { BotonLupa, VisorImagen } from '../componentes/VisorImagen'
import { useBaraja, useContenido } from '../datos/contenido'
import { seccionCompleta, seccionesDe } from '../datos/progresion'
import {
  marcarRecompensaMostrada,
  marcarSeccionCelebrada,
  progresoDe,
  registrarVictoria,
  useGuardado,
} from '../lib/almacen'
import { sonar, sonarEstrellas } from '../lib/audio'
import { useIdioma, useTexto } from '../lib/i18n'
import { formatearTiempo } from '../lib/tablero'
import { reglasDeNivel, reglasLibres, usePartida } from '../lib/usePartida'
import type { CartaCatalogo, Historia, Nivel } from '../tipos'

interface Props {
  libre?: boolean
}

type Confirmacion = 'salir' | 'reiniciar' | null
type PasoVictoria = 'resultado' | 'historia' | 'seccion'

export function Juego({ libre = false }: Props) {
  const { nivelId } = useParams()
  const { cartas, niveles } = useContenido()
  const ajustesLibres = useGuardado((estado) => estado.libre)
  const barajaLibre = useBaraja(ajustesLibres.baraja)

  const nivel = useMemo(
    () => (libre ? null : niveles.find((n) => n.id === decodeURIComponent(nivelId ?? ''))),
    [libre, niveles, nivelId],
  )

  const reglas = useMemo(() => {
    if (nivel) return reglasDeNivel(nivel)
    const molde = niveles.find((otro) => otro.cartas === ajustesLibres.cartas)
    return reglasLibres({
      cartas: ajustesLibres.cartas,
      columnas: molde?.columnas ?? 4,
      filas: molde?.filas ?? ajustesLibres.cartas / 4,
      segundos: ajustesLibres.segundos,
      vistazoSeg: ajustesLibres.vistazo ? 2.5 : 0,
      reverso: ajustesLibres.reverso ?? molde?.reverso ?? null,
    })
  }, [ajustesLibres, nivel, niveles])

  if (!libre && !nivel) return <NivelPerdido />
  if (libre && !barajaLibre) return null

  // La clave como `key` fuerza un montaje nuevo al pasar de nivel. Sin eso,
  // la partida se quedaba en fase "ganada" y el efecto de victoria registraba
  // estrellas en el nivel siguiente sin haberlo jugado.
  const clave =
    nivel?.id ??
    `libre-${ajustesLibres.baraja}-${ajustesLibres.cartas}-${ajustesLibres.segundos}`

  return (
    <Partida
      key={clave}
      clave={clave}
      nivel={nivel ?? null}
      reglas={reglas}
      baraja={libre ? (barajaLibre as CartaCatalogo[]) : cartas}
    />
  )
}

function NivelPerdido() {
  const navegar = useNavigate()
  useEffect(() => {
    navegar('/niveles', { replace: true })
  }, [navegar])
  return null
}

interface PartidaProps {
  clave: string
  nivel: Nivel | null
  reglas: ReturnType<typeof reglasDeNivel>
  baraja: CartaCatalogo[]
}

function Partida({ clave, nivel, reglas, baraja }: PartidaProps) {
  const navegar = useNavigate()
  const t = useTexto()
  const idioma = useIdioma()
  const { niveles, historias, secciones } = useContenido()

  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  const partida = usePartida(reglas, baraja)
  const { fase, resultado } = partida

  const salidaNiveles = nivel ? '/niveles' : '/libre'
  const yaGuardado = useRef<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion>(null)
  const [pasoVictoria, setPasoVictoria] = useState<PasoVictoria | null>(null)
  const [mensajeSeccion, setMensajeSeccion] = useState<string | null>(null)
  const [historiaNueva, setHistoriaNueva] = useState<Historia | null>(null)
  const [imagenAmpliada, setImagenAmpliada] = useState<string | null>(null)

  // Al ganar: guardar, preparar historia/sección y arrancar el flujo por pasos.
  useEffect(() => {
    if (fase !== 'ganada' || !resultado) return
    if (yaGuardado.current === clave) return
    yaGuardado.current = clave

    sonarEstrellas(resultado.estrellas)

    let historia: Historia | null = null
    let seccionTxt: string | null = null

    if (nivel) {
      registrarVictoria(pais, nivel.id, {
        estrellas: resultado.estrellas,
        mejorTiempo: resultado.segundos,
        menosErrores: resultado.errores,
      })

      if (nivel.historiaPremio) {
        const hallada = historias.find((h) => h.id === nivel.historiaPremio)
        if (hallada && !progreso.recompensasMostradas.includes(hallada.id)) {
          historia = hallada
        }
      }

      const seccion = seccionesDe(niveles).find((s) => s.cartas === nivel.cartas)
      const progresoTras = {
        ...progreso,
        niveles: {
          ...progreso.niveles,
          [nivel.id]: {
            estrellas: resultado.estrellas,
            mejorTiempo: resultado.segundos,
            menosErrores: resultado.errores,
          },
        },
      }
      if (
        seccion &&
        seccionCompleta(seccion, progresoTras) &&
        !progreso.seccionesCelebradas.includes(nivel.cartas)
      ) {
        const mensaje = secciones.find((s) => s.cartas === nivel.cartas)
        seccionTxt = mensaje ? mensaje[idioma] : t('seccionCompletada')
        marcarSeccionCelebrada(pais, nivel.cartas)
      }
    }

    setHistoriaNueva(historia)
    setMensajeSeccion(seccionTxt)
    setPasoVictoria('resultado')
  }, [
    clave,
    fase,
    historias,
    idioma,
    nivel,
    niveles,
    pais,
    progreso,
    resultado,
    secciones,
    t,
  ])

  // Al empezar otra ronda se limpia el flujo de victoria.
  useEffect(() => {
    if (fase === 'jugando' || fase === 'vistazo') {
      yaGuardado.current = null
      setPasoVictoria(null)
      setHistoriaNueva(null)
      setMensajeSeccion(null)
      setConfirmacion(null)
    }
    if (fase === 'perdida') {
      setPasoVictoria(null)
      setHistoriaNueva(null)
      setMensajeSeccion(null)
    }
  }, [fase])

  const siguiente = nivel
    ? niveles.find((otro) => otro.numero === nivel.numero + 1)
    : undefined

  const avanzarDesdeResultado = () => {
    if (historiaNueva) {
      sonar('transicion')
      setPasoVictoria('historia')
      return
    }
    if (mensajeSeccion) {
      sonar('seccion')
      setPasoVictoria('seccion')
      return
    }
    setPasoVictoria(null)
  }

  const avanzarDesdeHistoria = () => {
    if (historiaNueva) marcarRecompensaMostrada(pais, historiaNueva.id)
    if (mensajeSeccion) {
      sonar('seccion')
      setPasoVictoria('seccion')
      return
    }
    setPasoVictoria(null)
  }

  const leerHistoria = () => {
    if (historiaNueva) marcarRecompensaMostrada(pais, historiaNueva.id)
    navegar('/historias')
  }

  return (
    <main
      className="pantalla pantalla-juego"
      data-cartas={reglas.cartas}
    >
      <BarraPartida
        titulo={nivel?.nombre ?? t('libre')}
        restante={partida.restante}
        transcurrido={partida.transcurrido}
        sinLimite={partida.sinLimite}
        limite={reglas.segundos}
        errores={partida.errores}
        parejasHechas={partida.parejasHechas}
        totalParejas={partida.totalParejas}
        onPausar={partida.pausar}
      />

      <Tablero
        fichas={partida.fichas}
        columnas={reglas.columnas}
        filas={reglas.filas}
        reverso={reglas.reverso}
        revelando={partida.mostrarTodas}
        onVoltear={partida.voltear}
      />

      {partida.mostrarTodas && <p className="aviso-vistazo">{t('memoriza')}</p>}

      {/* Pausa + confirmación de salir/reiniciar */}
      <Modal
        abierto={partida.pausada && confirmacion === null}
        onCerrar={partida.reanudar}
      >
        <h2 className="modal-titulo">{t('pausa')}</h2>
        <div className="modal-acciones">
          <button type="button" className="boton-principal" onClick={partida.reanudar}>
            {t('continuar')}
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => setConfirmacion('reiniciar')}
          >
            {t('reiniciar')}
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => setConfirmacion('salir')}
          >
            {t('salir')}
          </button>
        </div>
      </Modal>

      <Modal abierto={confirmacion !== null} onCerrar={() => setConfirmacion(null)}>
        <h2 className="modal-titulo">{t('partidaEnCurso')}</h2>
        <p className="modal-texto">
          {confirmacion === 'salir' ? t('confirmarSalir') : t('confirmarReinicio')}
        </p>
        <div className="modal-acciones">
          <button
            type="button"
            className="boton-peligro"
            onClick={() => {
              if (confirmacion === 'salir') navegar(salidaNiveles)
              else {
                setConfirmacion(null)
                partida.reiniciar()
              }
            }}
          >
            {confirmacion === 'salir' ? t('salir') : t('reiniciar')}
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => setConfirmacion(null)}
          >
            {t('cancelar')}
          </button>
        </div>
      </Modal>

      {/* Derrota */}
      <Modal abierto={fase === 'perdida'}>
        {resultado && (
          <>
            <h2 className="modal-titulo">{t('derrota')}</h2>
            <p className="modal-elogio">{t('otraVez')}</p>
            <dl className="resumen">
              <div>
                <dt>{t('tuTiempo')}</dt>
                <dd>{formatearTiempo(resultado.segundos)}</dd>
              </div>
              <div>
                <dt>{t('tusErrores')}</dt>
                <dd>{resultado.errores}</dd>
              </div>
            </dl>
            <div className="modal-acciones">
              <button type="button" className="boton-principal" onClick={partida.reiniciar}>
                {t('reintentar')}
              </button>
              <button
                type="button"
                className="boton-secundario"
                onClick={() => navegar(salidaNiveles)}
              >
                {t('aNiveles')}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Victoria — paso 1: resultado */}
      <Modal abierto={fase === 'ganada' && pasoVictoria === 'resultado'}>
        {resultado && (
          <>
            <h2 className="modal-titulo">{t('victoria')}</h2>
            {nivel && (
              <>
                <Estrellas cantidad={resultado.estrellas} />
                <p className="modal-elogio">{elogio(resultado.estrellas, t)}</p>
              </>
            )}
            <dl className="resumen">
              <div>
                <dt>{t('tuTiempo')}</dt>
                <dd>{formatearTiempo(resultado.segundos)}</dd>
              </div>
              <div>
                <dt>{t('tusErrores')}</dt>
                <dd>{resultado.errores}</dd>
              </div>
            </dl>
            <div className="modal-acciones">
              {historiaNueva || mensajeSeccion ? (
                <button
                  type="button"
                  className="boton-principal"
                  onClick={avanzarDesdeResultado}
                >
                  {t('continuar')}
                </button>
              ) : (
                <>
                  {siguiente ? (
                    <button
                      type="button"
                      className="boton-principal"
                      onClick={() =>
                        navegar(`/juego/${encodeURIComponent(siguiente.id)}`)
                      }
                    >
                      {t('siguiente')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="boton-principal"
                      onClick={partida.reiniciar}
                    >
                      {t('reiniciar')}
                    </button>
                  )}
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => navegar(salidaNiveles)}
                  >
                    {t('aNiveles')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* Victoria — paso 2: ex libris de la historia */}
      <Modal abierto={pasoVictoria === 'historia' && historiaNueva !== null}>
        {historiaNueva && (
          <div className="exlibris">
            <p className="premio-titulo">{t('exLibris')}</p>
            {historiaNueva.imagen && (
              <div className="lamina lamina-premio">
                <img
                  className="detalle-imagen"
                  src={historiaNueva.imagen}
                  alt=""
                />
                <span className="lamina-esquinas" aria-hidden="true" />
                <BotonLupa onClick={() => setImagenAmpliada(historiaNueva.imagen)} />
              </div>
            )}
            <h2 className="modal-titulo">{t('nuevaHistoria')}</h2>
            <p className="premio-nombre">{historiaNueva.titulo}</p>
            {historiaNueva[idioma].presentacion && (
              <p className="premio-presentacion">
                {historiaNueva[idioma].presentacion}
              </p>
            )}
            <div className="modal-acciones">
              <button type="button" className="boton-principal" onClick={leerHistoria}>
                {t('verHistoria')}
              </button>
              <button
                type="button"
                className="boton-secundario"
                onClick={avanzarDesdeHistoria}
              >
                {t('seguirSinLeer')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Victoria — paso 3: sección cerrada */}
      <Modal abierto={pasoVictoria === 'seccion' && mensajeSeccion !== null}>
        <h2 className="modal-titulo">{t('seccionCompletada')}</h2>
        <p className="modal-texto-tenue">{t('seccionCompletadaPie')}</p>
        <p className="modal-texto">{mensajeSeccion}</p>
        <div className="modal-acciones">
          {siguiente ? (
            <button
              type="button"
              className="boton-principal"
              onClick={() => navegar(`/juego/${encodeURIComponent(siguiente.id)}`)}
            >
              {t('siguiente')}
            </button>
          ) : (
            <button
              type="button"
              className="boton-principal"
              onClick={() => navegar(salidaNiveles)}
            >
              {t('aNiveles')}
            </button>
          )}
          {siguiente && (
            <button
              type="button"
              className="boton-secundario"
              onClick={() => navegar(salidaNiveles)}
            >
              {t('aNiveles')}
            </button>
          )}
        </div>
      </Modal>

      <VisorImagen
        src={imagenAmpliada}
        alt={historiaNueva?.titulo ?? ''}
        onCerrar={() => setImagenAmpliada(null)}
      />

      {/* Acciones finales si cerraste historia/sección sin ir a niveles */}
      <Modal
        abierto={
          fase === 'ganada' &&
          pasoVictoria === null &&
          yaGuardado.current === clave
        }
      >
        <h2 className="modal-titulo">{t('victoria')}</h2>
        <div className="modal-acciones">
          {siguiente ? (
            <button
              type="button"
              className="boton-principal"
              onClick={() => navegar(`/juego/${encodeURIComponent(siguiente.id)}`)}
            >
              {t('siguiente')}
            </button>
          ) : (
            <button type="button" className="boton-principal" onClick={partida.reiniciar}>
              {t('reiniciar')}
            </button>
          )}
          <button
            type="button"
            className="boton-secundario"
            onClick={() => navegar(salidaNiveles)}
          >
            {t('aNiveles')}
          </button>
        </div>
      </Modal>
    </main>
  )
}

function elogio(estrellas: number, t: ReturnType<typeof useTexto>): string {
  if (estrellas === 3) return t('impecable')
  if (estrellas === 2) return t('muyBien')
  if (estrellas === 1) return t('justoATiempo')
  return t('aDurasPenas')
}
