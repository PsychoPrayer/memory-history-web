import { useSyncExternalStore } from 'react'
import type { BarajaLibre, CodigoPais, Estrellas, Idioma } from '../tipos'

/**
 * Guardado del jugador.
 *
 * Unity repartía esto en decenas de claves sueltas de PlayerPrefs con prefijo
 * de país. Aquí es un único objeto: cuesta lo mismo leerlo y el día que
 * enchufemos Supabase se sube de una pieza en vez de campo a campo.
 */

const CLAVE = 'memoryhistory.guardado'
const VERSION = 1

export interface MarcaNivel {
  estrellas: Estrellas
  mejorTiempo: number
  menosErrores: number
}

export interface MarcaTest {
  completado: boolean
  mejorNota: number
}

export interface ProgresoPais {
  niveles: Record<string, MarcaNivel>
  historiasLeidas: string[]
  recompensasMostradas: string[]
  seccionesCelebradas: number[]
  tests: Record<string, MarcaTest>
  logros: Record<string, number>
}

export interface Ajustes {
  idioma: Idioma
  pais: CodigoPais
  volumenMusica: number
  volumenEfectos: number
  idiomaElegido: boolean
  terminosAceptados: boolean
  guiaVista: boolean
}

/** Equivale a las claves PancitoLandia* que el original guardaba en PlayerPrefs. */
export interface AjustesLibres {
  cartas: number
  segundos: number
  vistazo: boolean
  baraja: BarajaLibre
  /** Reverso elegido a mano. Si es null manda el de la sección. */
  reverso: string | null
}

export interface EstadoGuardado {
  version: number
  ajustes: Ajustes
  libre: AjustesLibres
  paises: Record<string, ProgresoPais>
}

// ---------------------------------------------------------------------------
// Valores de partida
// ---------------------------------------------------------------------------

/**
 * Compartido a propósito. `useSyncExternalStore` exige que la instantánea sea
 * estable entre lecturas: si devolviéramos un objeto nuevo cada vez, React
 * entraría en un bucle de renderizado. Todas las escrituras son inmutables,
 * así que compartir esta constante es seguro.
 */
const PROGRESO_VACIO: ProgresoPais = {
  niveles: {},
  historiasLeidas: [],
  recompensasMostradas: [],
  seccionesCelebradas: [],
  tests: {},
  logros: {},
}
Object.freeze(PROGRESO_VACIO)

function progresoVacio(): ProgresoPais {
  return PROGRESO_VACIO
}

function estadoInicial(): EstadoGuardado {
  return {
    version: VERSION,
    ajustes: {
      idioma: idiomaDelNavegador(),
      pais: 'VE',
      volumenMusica: 0.6,
      volumenEfectos: 0.8,
      idiomaElegido: false,
      terminosAceptados: false,
      guiaVista: false,
    },
    libre: {
      cartas: 16,
      segundos: 0,
      vistazo: true,
      baraja: 'PL',
      reverso: null,
    },
    paises: {},
  }
}

function idiomaDelNavegador(): Idioma {
  if (typeof navigator === 'undefined') return 'es'
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

// ---------------------------------------------------------------------------
// Lectura y escritura
// ---------------------------------------------------------------------------

let estado: EstadoGuardado = cargar()
const oyentes = new Set<() => void>()

function cargar(): EstadoGuardado {
  if (typeof localStorage === 'undefined') return estadoInicial()
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return estadoInicial()
    const leido = JSON.parse(crudo) as Partial<EstadoGuardado>
    const base = estadoInicial()
    return {
      version: VERSION,
      ajustes: { ...base.ajustes, ...leido.ajustes },
      libre: { ...base.libre, ...leido.libre },
      paises: leido.paises ?? {},
    }
  } catch {
    return estadoInicial()
  }
}

function persistir() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch {
    // Modo incógnito o cuota llena: la partida sigue, solo no se guarda.
  }
  sincronizador?.(estado)
  for (const oyente of oyentes) oyente()
}

/**
 * Punto de enganche para la sincronización en la nube. Mientras no se
 * registre nada, el juego funciona entero contra el disco local.
 */
type Sincronizador = (estado: EstadoGuardado) => void
let sincronizador: Sincronizador | null = null

export function registrarSincronizador(fn: Sincronizador | null) {
  sincronizador = fn
}

export function leerEstado(): EstadoGuardado {
  return estado
}

export function actualizar(cambio: (previo: EstadoGuardado) => EstadoGuardado) {
  estado = cambio(estado)
  persistir()
}

export function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

export function useGuardado<T>(seleccionar: (estado: EstadoGuardado) => T): T {
  return useSyncExternalStore(
    suscribir,
    () => seleccionar(estado),
    () => seleccionar(estado),
  )
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------

export function cambiarAjuste<C extends keyof Ajustes>(clave: C, valor: Ajustes[C]) {
  actualizar((previo) => ({
    ...previo,
    ajustes: { ...previo.ajustes, [clave]: valor },
  }))
}

export function cambiarAjustesLibres(cambio: Partial<AjustesLibres>) {
  actualizar((previo) => ({ ...previo, libre: { ...previo.libre, ...cambio } }))
}

// ---------------------------------------------------------------------------
// Progreso por país
// ---------------------------------------------------------------------------

export function progresoDe(pais: CodigoPais): ProgresoPais {
  return estado.paises[pais] ?? progresoVacio()
}

function conProgreso(
  pais: CodigoPais,
  cambio: (progreso: ProgresoPais) => ProgresoPais,
) {
  actualizar((previo) => ({
    ...previo,
    paises: {
      ...previo.paises,
      [pais]: cambio(previo.paises[pais] ?? progresoVacio()),
    },
  }))
}

/** Guarda la marca de un nivel, conservando siempre la mejor de cada campo. */
export function registrarVictoria(
  pais: CodigoPais,
  nivelId: string,
  marca: MarcaNivel,
) {
  conProgreso(pais, (progreso) => {
    const anterior = progreso.niveles[nivelId]
    const mejor: MarcaNivel = anterior
      ? {
          estrellas: Math.max(anterior.estrellas, marca.estrellas) as Estrellas,
          mejorTiempo: Math.min(anterior.mejorTiempo, marca.mejorTiempo),
          menosErrores: Math.min(anterior.menosErrores, marca.menosErrores),
        }
      : marca
    return { ...progreso, niveles: { ...progreso.niveles, [nivelId]: mejor } }
  })
}

export function marcarHistoriaLeida(pais: CodigoPais, historiaId: string) {
  conProgreso(pais, (progreso) =>
    progreso.historiasLeidas.includes(historiaId)
      ? progreso
      : { ...progreso, historiasLeidas: [...progreso.historiasLeidas, historiaId] },
  )
}

export function marcarRecompensaMostrada(pais: CodigoPais, historiaId: string) {
  conProgreso(pais, (progreso) =>
    progreso.recompensasMostradas.includes(historiaId)
      ? progreso
      : {
          ...progreso,
          recompensasMostradas: [...progreso.recompensasMostradas, historiaId],
        },
  )
}

export function marcarSeccionCelebrada(pais: CodigoPais, cartas: number) {
  conProgreso(pais, (progreso) =>
    progreso.seccionesCelebradas.includes(cartas)
      ? progreso
      : {
          ...progreso,
          seccionesCelebradas: [...progreso.seccionesCelebradas, cartas],
        },
  )
}

export function registrarTest(pais: CodigoPais, nivel: number, nota: number) {
  conProgreso(pais, (progreso) => {
    const clave = String(nivel)
    const anterior = progreso.tests[clave]
    return {
      ...progreso,
      tests: {
        ...progreso.tests,
        [clave]: {
          completado: true,
          mejorNota: Math.max(anterior?.mejorNota ?? 0, nota),
        },
      },
    }
  })
}

export function registrarLogros(pais: CodigoPais, progresoLogros: Record<string, number>) {
  conProgreso(pais, (progreso) => ({
    ...progreso,
    logros: { ...progreso.logros, ...progresoLogros },
  }))
}

/** Borra el progreso del país activo y respeta ajustes y el resto de países. */
export function borrarProgreso(pais: CodigoPais) {
  actualizar((previo) => {
    const paises = { ...previo.paises }
    delete paises[pais]
    return { ...previo, paises }
  })
}
