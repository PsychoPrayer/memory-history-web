import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CartaCatalogo,
  FasePartida,
  FichaTablero,
  Nivel,
  PartidaLibre,
  Resultado,
  UmbralesDeError,
} from '../tipos'
import { calcularEstrellas } from '../datos/progresion'
import { construirTablero } from './tablero'
import { sonar } from './audio'

const ESPERA_ACIERTO = 380
const ESPERA_MARCA_FALLO = 460
const ESPERA_VUELTA_FALLO = 1100

export interface ReglasPartida {
  cartas: number
  columnas: number
  filas: number
  /** 0 significa sin límite: el reloj cuenta hacia arriba. */
  segundos: number
  vistazoSeg: number
  errores: UmbralesDeError
  /** Imagen del dorso. Sin ella se dibuja el reverso de respaldo en CSS. */
  reverso: string | null
}

export function reglasDeNivel(nivel: Nivel): ReglasPartida {
  return {
    cartas: nivel.cartas,
    columnas: nivel.columnas,
    filas: nivel.filas,
    segundos: nivel.segundos,
    vistazoSeg: nivel.vistazoSeg,
    errores: nivel.errores,
    reverso: nivel.reverso,
  }
}

/** PancitoLandia: mismas reglas pero sin estrellas ni progresión. */
export function reglasLibres(config: PartidaLibre): ReglasPartida {
  return {
    cartas: config.cartas,
    columnas: config.columnas,
    filas: config.filas,
    segundos: config.segundos,
    vistazoSeg: config.vistazoSeg,
    errores: { tres: 0, dos: 0, una: 0 },
    reverso: config.reverso,
  }
}

export function usePartida(reglas: ReglasPartida, catalogo: CartaCatalogo[]) {
  const [fichas, setFichas] = useState(() =>
    construirTablero(catalogo, reglas.cartas),
  )
  const [fase, setFase] = useState<FasePartida>(
    reglas.vistazoSeg > 0 ? 'vistazo' : 'jugando',
  )
  const [pausada, setPausada] = useState(false)
  const [errores, setErrores] = useState(0)
  const [transcurrido, setTranscurrido] = useState(0)
  const [comparando, setComparando] = useState(false)

  const temporizadores = useRef<number[]>([])
  const ultimoAviso = useRef(Infinity)

  const sinLimite = reglas.segundos === 0
  const restante = sinLimite ? Infinity : Math.max(0, reglas.segundos - transcurrido)

  const limpiar = useCallback(() => {
    temporizadores.current.forEach(clearTimeout)
    temporizadores.current = []
  }, [])

  const agendar = useCallback((accion: () => void, ms: number) => {
    temporizadores.current.push(window.setTimeout(accion, ms))
  }, [])

  useEffect(() => limpiar, [limpiar])

  const reiniciar = useCallback(() => {
    limpiar()
    setFichas(construirTablero(catalogo, reglas.cartas))
    setFase(reglas.vistazoSeg > 0 ? 'vistazo' : 'jugando')
    setPausada(false)
    setErrores(0)
    setTranscurrido(0)
    setComparando(false)
    ultimoAviso.current = Infinity
  }, [catalogo, limpiar, reglas.cartas, reglas.vistazoSeg])

  // Vistazo inicial: el tablero se enseña entero antes de arrancar el reloj.
  useEffect(() => {
    if (fase !== 'vistazo') return
    const id = window.setTimeout(() => setFase('jugando'), reglas.vistazoSeg * 1000)
    return () => clearTimeout(id)
  }, [fase, reglas.vistazoSeg])

  useEffect(() => {
    if (fase !== 'jugando' || pausada) return
    const id = window.setInterval(() => setTranscurrido((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [fase, pausada])

  // Aviso sonoro en los últimos diez segundos.
  useEffect(() => {
    if (fase !== 'jugando' || pausada || sinLimite) return
    if (restante <= 10 && restante > 0 && restante < ultimoAviso.current) {
      ultimoAviso.current = restante
      sonar('apremio')
    }
  }, [fase, pausada, restante, sinLimite])

  useEffect(() => {
    if (fase !== 'jugando' || sinLimite) return
    if (restante <= 0) {
      limpiar()
      setFase('perdida')
      sonar('derrota')
    }
  }, [fase, limpiar, restante, sinLimite])

  useEffect(() => {
    if (fase !== 'jugando') return
    if (fichas.length && fichas.every((ficha) => ficha.estado === 'emparejada')) {
      setFase('ganada')
      sonar('victoria')
    }
  }, [fase, fichas])

  const voltear = useCallback(
    (clave: string) => {
      if (fase !== 'jugando' || pausada || comparando) return

      const elegida = fichas.find((ficha) => ficha.clave === clave)
      if (!elegida || elegida.estado !== 'oculta') return

      const abiertas = fichas.filter((ficha) => ficha.estado === 'volteada')
      if (abiertas.length >= 2) return

      sonar('carta')
      setFichas(
        fichas.map((ficha) =>
          ficha.clave === clave ? { ...ficha, estado: 'volteada' as const } : ficha,
        ),
      )
      if (abiertas.length === 0) return

      const primera = abiertas[0]
      const enJuego = (ficha: FichaTablero) =>
        ficha.clave === primera.clave || ficha.clave === clave

      setComparando(true)

      if (primera.carta.id === elegida.carta.id) {
        agendar(() => {
          setFichas((actual) =>
            actual.map((f) => (enJuego(f) ? { ...f, estado: 'emparejada' as const } : f)),
          )
          setComparando(false)
          sonar('acierto')
        }, ESPERA_ACIERTO)
        return
      }

      setErrores((valor) => valor + 1)
      sonar('fallo')

      agendar(() => {
        setFichas((actual) =>
          actual.map((f) => (enJuego(f) ? { ...f, estado: 'fallida' as const } : f)),
        )
      }, ESPERA_MARCA_FALLO)

      agendar(() => {
        setFichas((actual) =>
          actual.map((f) => (enJuego(f) ? { ...f, estado: 'oculta' as const } : f)),
        )
        setComparando(false)
      }, ESPERA_VUELTA_FALLO)
    },
    [agendar, comparando, fase, fichas, pausada],
  )

  const parejasHechas = useMemo(
    () => fichas.filter((ficha) => ficha.estado === 'emparejada').length / 2,
    [fichas],
  )

  const resultado: Resultado | null = useMemo(() => {
    if (fase !== 'ganada' && fase !== 'perdida') return null
    return {
      estrellas: fase === 'ganada' ? calcularEstrellas(errores, reglas.errores) : 0,
      segundos: transcurrido,
      errores,
    }
  }, [errores, fase, reglas.errores, transcurrido])

  return {
    fichas,
    fase,
    pausada,
    errores,
    transcurrido,
    restante,
    sinLimite,
    /** Durante el vistazo se enseña el tablero entero. */
    mostrarTodas: fase === 'vistazo',
    parejasHechas,
    totalParejas: reglas.cartas / 2,
    resultado,
    voltear,
    reiniciar,
    pausar: () => setPausada(true),
    reanudar: () => setPausada(false),
  }
}
