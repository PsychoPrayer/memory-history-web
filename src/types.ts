export type Language = 'es' | 'en'
export type CountryCode = 'VE' | 'ES' | 'EU'

/** Free-play decks. Pancitolandia has its own cards but no campaign levels or stories. */
export type FreeDeck = CountryCode | 'PL'

export type Stars = 0 | 1 | 2 | 3

// ---------------------------------------------------------------------------
// Content exported from Unity (src/content/<country>/*.json)
// ---------------------------------------------------------------------------

export interface Country {
  id: CountryCode
  es: string
  en: string
  bandera: string | null
}

export interface CardCatalog {
  id: string
  nombre: string
  imagen: string | null
  /** Minimum board size at which this card can appear. */
  desbloqueoEn: number
}

export interface ErrorThresholds {
  tres: number
  dos: number
  una: number
}

export interface Level {
  id: string
  nombre: string
  numero: number
  cartas: number
  dificil: boolean
  columnas: number
  filas: number
  /** Time limit in seconds. 0 means no limit. */
  segundos: number
  /** Seconds cards stay face-up at start. 0 on hard levels. */
  vistazoSeg: number
  volteoSeg: number
  errores: ErrorThresholds
  historiaPremio: string | null
  requisito: string | null
  abiertoPorDefecto: boolean
  /** Section-specific card back. One per board size. */
  reverso: string | null
}

export interface StoryText {
  presentacion: string
  texto: string[]
}

export interface Story {
  id: string
  titulo: string
  imagen: string | null
  es: StoryText
  en: StoryText
  nivelDesbloqueo: string | null
  abiertaPorDefecto: boolean
}

export interface QuestionPrompt {
  enunciado: string
  opciones: string[]
}

export interface Question {
  id: string
  historia: string
  numero: number
  correcta: number
  es: QuestionPrompt
  en: QuestionPrompt
}

export interface Test {
  nivel: number
  nombre: string
  desdeHistoria: number
  hastaHistoria: number
  preguntas: number
  segundos: number
}

export interface AchievementText {
  titulo: string
  descripcion: string
}

export interface Achievement {
  id: string
  es: AchievementText
  en: AchievementText
  tipo: number
  objetivo: number
  conProgreso: boolean
  icono: string | null
}

export interface SectionMessage {
  cartas: number
  es: string
  en: string
  imagen: string | null
}

export interface CountryContent {
  country: Country
  cards: CardCatalog[]
  levels: Level[]
  stories: Story[]
  questions: Question[]
  tests: Test[]
  achievements: Achievement[]
  sections: SectionMessage[]
}

// ---------------------------------------------------------------------------
// Match state
// ---------------------------------------------------------------------------

export type CardState = 'hidden' | 'flipped' | 'matched' | 'failed'

export type MatchPhase = 'peek' | 'playing' | 'won' | 'lost'

export interface BoardTile {
  key: string
  card: CardCatalog
  state: CardState
}

export interface Result {
  stars: Stars
  seconds: number
  mistakes: number
}

/** PancitoLandia free match: same rules but no progression, player-chosen params. */
export interface FreeMatch {
  cards: number
  columns: number
  rows: number
  seconds: number
  peekSeconds: number
  back: string | null
}
