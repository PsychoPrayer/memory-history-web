import type { ProgresoPais } from '../lib/almacen'
import type {
  Estrellas,
  Historia,
  Logro,
  Nivel,
  Test,
  UmbralesDeError,
} from '../tipos'

/**
 * Reglas de progresión: qué está abierto, cuántas estrellas se han ganado y
 * qué logros se cumplen. Todo se deriva del contenido más el progreso, sin
 * estado propio.
 */

export interface Seccion {
  cartas: number
  normales: Nivel[]
  dificiles: Nivel[]
}

export function seccionesDe(niveles: Nivel[]): Seccion[] {
  const porCartas = new Map<number, Seccion>()

  for (const nivel of niveles) {
    let seccion = porCartas.get(nivel.cartas)
    if (!seccion) {
      seccion = { cartas: nivel.cartas, normales: [], dificiles: [] }
      porCartas.set(nivel.cartas, seccion)
    }
    ;(nivel.dificil ? seccion.dificiles : seccion.normales).push(nivel)
  }

  for (const seccion of porCartas.values()) {
    seccion.normales.sort((a, b) => a.numero - b.numero)
    seccion.dificiles.sort((a, b) => a.numero - b.numero)
  }

  return [...porCartas.values()].sort((a, b) => a.cartas - b.cartas)
}

export function estrellasDe(progreso: ProgresoPais, nivelId: string): Estrellas {
  return progreso.niveles[nivelId]?.estrellas ?? 0
}

export function estaSuperado(progreso: ProgresoPais, nivelId: string): boolean {
  return estrellasDe(progreso, nivelId) > 0
}

/**
 * El campo `numero` de los niveles es una secuencia limpia del 1 al 140 que
 * recorre las siete secciones, y dentro de cada una los diez normales antes
 * que los diez difíciles. Así que la cadena de desbloqueo es simplemente el
 * nivel anterior.
 */
export function estaDesbloqueado(
  nivel: Nivel,
  niveles: Nivel[],
  progreso: ProgresoPais,
): boolean {
  if (nivel.abiertoPorDefecto) return true
  if (estaSuperado(progreso, nivel.id)) return true

  if (nivel.requisito) {
    return estaSuperado(progreso, nivel.requisito)
  }

  const anterior = niveles.find((otro) => otro.numero === nivel.numero - 1)
  if (!anterior) return true
  return estaSuperado(progreso, anterior.id)
}

export function calcularEstrellas(
  errores: number,
  umbrales: UmbralesDeError,
): Estrellas {
  if (errores <= umbrales.tres) return 3
  if (errores <= umbrales.dos) return 2
  if (errores <= umbrales.una) return 1
  return 0
}

export function totalEstrellas(progreso: ProgresoPais): number {
  return Object.values(progreso.niveles).reduce(
    (suma, marca) => suma + marca.estrellas,
    0,
  )
}

export function seccionCompleta(
  seccion: Seccion,
  progreso: ProgresoPais,
): boolean {
  const todos = [...seccion.normales, ...seccion.dificiles]
  return todos.length > 0 && todos.every((nivel) => estaSuperado(progreso, nivel.id))
}

// ---------------------------------------------------------------------------
// Historias
// ---------------------------------------------------------------------------

/** Una historia se abre al superar el nivel que la tiene como recompensa. */
export function historiasDesbloqueadas(
  historias: Historia[],
  niveles: Nivel[],
  progreso: ProgresoPais,
): Set<string> {
  const abiertas = new Set<string>()

  for (const nivel of niveles) {
    if (nivel.historiaPremio && estaSuperado(progreso, nivel.id)) {
      abiertas.add(nivel.historiaPremio)
    }
  }

  for (const historia of historias) {
    if (historia.abiertaPorDefecto) abiertas.add(historia.id)
    if (historia.nivelDesbloqueo && estaSuperado(progreso, historia.nivelDesbloqueo)) {
      abiertas.add(historia.id)
    }
  }

  return abiertas
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * Por qué no se puede entrar todavía a un test, o `null` si sí se puede.
 *
 * Devolver el motivo concreto en vez de un simple booleano evita mentirle al
 * jugador: el test 1 no tiene ninguno anterior, así que decirle que complete
 * «el test anterior» no significaba nada.
 */
export type MotivoBloqueo =
  | { tipo: 'testAnterior'; nivel: number }
  | { tipo: 'historias'; desde: number; hasta: number }

export function motivoDeBloqueo(
  test: Test,
  tests: Test[],
  abiertas: Set<string>,
  progreso: ProgresoPais,
): MotivoBloqueo | null {
  // Primero las historias: es el requisito real del test 1 (no hay test
  // anterior) y el más útil de enseñar al jugador en cualquier caso.
  for (let n = test.desdeHistoria; n <= test.hastaHistoria; n += 1) {
    if (!abiertas.has(String(n))) {
      return { tipo: 'historias', desde: test.desdeHistoria, hasta: test.hastaHistoria }
    }
  }

  const anterior = tests.find((otro) => otro.nivel === test.nivel - 1)
  if (anterior && !progreso.tests[String(anterior.nivel)]?.completado) {
    return { tipo: 'testAnterior', nivel: anterior.nivel }
  }

  return null
}

export function testDesbloqueado(
  test: Test,
  tests: Test[],
  abiertas: Set<string>,
  progreso: ProgresoPais,
): boolean {
  return motivoDeBloqueo(test, tests, abiertas, progreso) === null
}

// ---------------------------------------------------------------------------
// Logros
// ---------------------------------------------------------------------------

export interface ResumenJugador {
  estrellas: number
  nivelesNormales: number
  nivelesDificiles: number
  nivelesTotales: number
  nivelesPerfectos: number
  historiasAbiertas: number
  historiasLeidas: number
  testsCompletados: number
  testsPorNivel: Set<number>
  seccionesCompletas: Set<number>
}

export function resumirJugador(
  niveles: Nivel[],
  historias: Historia[],
  progreso: ProgresoPais,
): ResumenJugador {
  const abiertas = historiasDesbloqueadas(historias, niveles, progreso)

  let nivelesNormales = 0
  let nivelesDificiles = 0
  let nivelesPerfectos = 0

  for (const nivel of niveles) {
    const estrellas = estrellasDe(progreso, nivel.id)
    if (estrellas === 0) continue
    if (nivel.dificil) nivelesDificiles += 1
    else nivelesNormales += 1
    if (estrellas === 3) nivelesPerfectos += 1
  }

  const seccionesCompletas = new Set<number>()
  for (const seccion of seccionesDe(niveles)) {
    if (seccionCompleta(seccion, progreso)) seccionesCompletas.add(seccion.cartas)
  }

  const testsPorNivel = new Set<number>()
  for (const [clave, marca] of Object.entries(progreso.tests)) {
    if (marca.completado) testsPorNivel.add(Number(clave))
  }

  return {
    estrellas: totalEstrellas(progreso),
    nivelesNormales,
    nivelesDificiles,
    nivelesTotales: nivelesNormales + nivelesDificiles,
    nivelesPerfectos,
    historiasAbiertas: abiertas.size,
    historiasLeidas: progreso.historiasLeidas.length,
    testsCompletados: testsPorNivel.size,
    testsPorNivel,
    seccionesCompletas,
  }
}

/**
 * El identificador del logro describe su condición mejor que el enum numérico
 * que Unity serializaba, así que la evaluación se apoya en él.
 */
export function progresoDeLogro(logro: Logro, resumen: ResumenJugador): number {
  const id = logro.id

  if (id === 'ach_first_level') return Math.min(resumen.nivelesTotales, 1)
  if (id === 'ach_perfect_level') return Math.min(resumen.nivelesPerfectos, 1)
  if (id === 'ach_first_story') return Math.min(resumen.historiasLeidas, 1)
  if (id === 'ach_first_test') return Math.min(resumen.testsCompletados, 1)
  if (id === 'ach_all_tests') return resumen.testsCompletados

  const test = id.match(/^ach_test_(\d)$/)
  if (test) return resumen.testsPorNivel.has(Number(test[1])) ? 1 : 0

  const seccion = id.match(/^ach_section_(\d+)_cards$/)
  if (seccion) return resumen.seccionesCompletas.has(Number(seccion[1])) ? 1 : 0

  if (id.endsWith('_normal_levels')) return resumen.nivelesNormales
  if (id.endsWith('_hard_levels')) return resumen.nivelesDificiles
  if (id.endsWith('_perfect_levels')) return resumen.nivelesPerfectos
  if (id.endsWith('_stories_unlock')) return resumen.historiasAbiertas
  if (id.endsWith('_stories_read')) return resumen.historiasLeidas
  if (id.endsWith('_stars')) return resumen.estrellas
  if (id.endsWith('_levels')) return resumen.nivelesTotales

  return 0
}

export function logroConseguido(logro: Logro, resumen: ResumenJugador): boolean {
  return progresoDeLogro(logro, resumen) >= logro.objetivo
}
