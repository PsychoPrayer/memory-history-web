export type Idioma = 'es' | 'en'
export type CodigoPais = 'VE' | 'ES' | 'EU'

/**
 * Barajas del modo libre. Pancitolandia tiene cartas propias pero ni niveles
 * ni historias, así que no es un país jugable en la campaña.
 */
export type BarajaLibre = CodigoPais | 'PL'

export type Estrellas = 0 | 1 | 2 | 3

// ---------------------------------------------------------------------------
// Contenido exportado desde Unity (src/contenido/<pais>/*.json)
// ---------------------------------------------------------------------------

export interface Pais {
  id: CodigoPais
  es: string
  en: string
  bandera: string | null
}

export interface CartaCatalogo {
  id: string
  nombre: string
  imagen: string | null
  /** Tamaño mínimo de tablero en el que esta carta puede aparecer. */
  desbloqueoEn: number
}

export interface UmbralesDeError {
  tres: number
  dos: number
  una: number
}

export interface Nivel {
  id: string
  nombre: string
  numero: number
  cartas: number
  dificil: boolean
  columnas: number
  filas: number
  /** Límite de tiempo en segundos. 0 significa sin límite. */
  segundos: number
  /** Segundos que las cartas se muestran al empezar. 0 en los difíciles. */
  vistazoSeg: number
  volteoSeg: number
  errores: UmbralesDeError
  historiaPremio: string | null
  requisito: string | null
  abiertoPorDefecto: boolean
  /** Reverso propio de la sección. Hay uno por cada tamaño de tablero. */
  reverso: string | null
}

export interface TextoHistoria {
  presentacion: string
  texto: string[]
}

export interface Historia {
  id: string
  titulo: string
  imagen: string | null
  es: TextoHistoria
  en: TextoHistoria
  nivelDesbloqueo: string | null
  abiertaPorDefecto: boolean
}

export interface EnunciadoPregunta {
  enunciado: string
  opciones: string[]
}

export interface Pregunta {
  id: string
  historia: string
  numero: number
  correcta: number
  es: EnunciadoPregunta
  en: EnunciadoPregunta
}

export interface Test {
  nivel: number
  nombre: string
  desdeHistoria: number
  hastaHistoria: number
  preguntas: number
  segundos: number
}

export interface TextoLogro {
  titulo: string
  descripcion: string
}

export interface Logro {
  id: string
  es: TextoLogro
  en: TextoLogro
  tipo: number
  objetivo: number
  conProgreso: boolean
  icono: string | null
}

export interface MensajeSeccion {
  cartas: number
  es: string
  en: string
  imagen: string | null
}

export interface ContenidoPais {
  pais: Pais
  cartas: CartaCatalogo[]
  niveles: Nivel[]
  historias: Historia[]
  preguntas: Pregunta[]
  tests: Test[]
  logros: Logro[]
  secciones: MensajeSeccion[]
}

// ---------------------------------------------------------------------------
// Estado de una partida
// ---------------------------------------------------------------------------

export type EstadoCarta = 'oculta' | 'volteada' | 'emparejada' | 'fallida'

export type FasePartida = 'vistazo' | 'jugando' | 'ganada' | 'perdida'

export interface FichaTablero {
  clave: string
  carta: CartaCatalogo
  estado: EstadoCarta
}

export interface Resultado {
  estrellas: Estrellas
  segundos: number
  errores: number
}

/**
 * Partida libre de PancitoLandia: mismas reglas pero sin progresión, con los
 * parámetros que elige el jugador.
 */
export interface PartidaLibre {
  cartas: number
  columnas: number
  filas: number
  segundos: number
  vistazoSeg: number
  reverso: string | null
}
