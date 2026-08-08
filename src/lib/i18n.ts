import { useSave } from './save'
import type { Language } from '../types'

const es = {
  play: 'Jugar',
  stories: 'Historias',
  settings: 'Configuración',
  tests: 'Tests',
  achievements: 'Logros',
  credits: 'Créditos',
  freePlay: 'PancitoLandia',
  back: 'Volver',
  close: 'Cerrar',
  continue: 'Continuar',
  next: 'Siguiente',
  accept: 'Aceptar',
  cancel: 'Cancelar',
  yes: 'Sí',
  no: 'No',

  levels: 'Niveles',
  normal: 'Normales',
  hard: 'Difíciles',
  level: 'Nivel',
  cardsCount: '{n} cartas',

  countries: 'Países',
  chooseCountry: 'Elige país',
  countryNotExported: 'sin exportar todavía',
  deck: 'Baraja',
  cardBack: 'Reverso de las cartas',
  sectionDefaultBack: 'El de la sección',

  section12: 'Aprendiz',
  section16: 'Descubridor',
  section20: 'Historiador',
  section24: 'Arqueólogo',
  section28: 'Expedicionario',
  section32: 'Maestro',
  section40: 'Erudito',
  sectionLabel: 'Nivel {name} · {n} cartas',

  locked: 'Bloqueado',
  completePrevious: 'Completa el nivel anterior',
  starsOf: '{a} de {b}',

  time: 'Tiempo',
  mistakes: 'Errores',
  pairs: 'Parejas',
  paused: 'Pausa',
  restart: 'Reiniciar',
  quit: 'Salir',
  memorize: 'Memoriza',
  noLimit: 'Sin límite',
  confirmQuit: 'Si sales ahora, se pierde esta partida.',
  confirmRestart: '¿Empezar de nuevo esta partida?',
  matchInProgress: 'Partida en curso',

  victory: '¡Nivel superado!',
  defeat: 'Se acabó el tiempo',
  yourTime: 'Tu tiempo',
  yourMistakes: 'Errores',
  tryAgain: 'Reintentar',
  toLevels: 'A los niveles',
  flawless: 'Impecable',
  wellDone: 'Muy bien',
  justInTime: 'Justo a tiempo',
  byTheSkin: 'A duras penas',
  nextTime: 'Otra vez será',

  storyLocked: 'Gana el nivel para descubrirla',
  storyNew: 'Nueva',
  storiesRead: '{a} de {b} descubiertas',
  newStory: '¡Historia desbloqueada!',
  readStory: 'Leer la historia',
  continueWithoutReading: 'Seguir',
  exLibris: 'Ex libris',
  viewImage: 'Ver imagen',

  sectionComplete: '¡Sección completada!',
  sectionCompleteFooter: 'Has cerrado este capítulo del libro.',

  language: 'Idioma',
  music: 'Música',
  soundEffects: 'Efectos',
  resetProgress: 'Reiniciar progreso',
  confirmResetProgress: '¿Seguro? Se borrarán todas tus estrellas e historias.',
  country: 'País',

  test: 'Test',
  blockPreviousTest: 'Completa antes el test {n}',
  blockStories: 'Desbloquea las historias {a} a {b}',
  blockFirstStories: 'Desbloquea las primeras {n} historias',
  testCompleted: 'Completado',
  yourScore: 'Tu nota',
  questionOf: 'Pregunta {a} de {b}',
  scoreLow: 'Sigue intentándolo. Vuelve a leer las historias.',
  scoreMedium: 'Buen trabajo. Vas por buen camino.',
  scoreHigh: 'Excelente. Casi te lo sabes todo.',
  scorePerfect: '¡Perfecto! No has fallado ni una.',

  achievementUnlocked: 'Logro desbloqueado',
  achievementProgressLabel: '{a} de {b}',

  cardCount: 'Cartas',
  timeLimit: 'Tiempo',
  openingGlance: 'Vistazo inicial',
  startMatch: 'Empezar',

  chooseLanguage: 'Elige tu idioma',
  termsTitle: 'Términos y condiciones',
  termsHelp: 'Lee el documento completo. Debes aceptarlo para continuar.',
  termsAccept: 'He leído y acepto las condiciones de uso',
  welcome: 'Bienvenido a Memory History',
  skip: 'Saltar',
  howToPlay: 'Cómo se juega',
  help: 'Ayuda',
  guideStep1:
    'Arriba del título está el país. Tócalo para cambiar (Venezuela, España, Estados Unidos…). Cada país guarda su propio progreso.',
  guideStep2:
    'Pulsa Jugar para elegir un nivel de memoria. Empareja las cartas iguales antes de que se acabe el tiempo.',
  guideStep3:
    'Al ganar un nivel puedes desbloquear una historia. Léelas en Historias cuando quieras.',
  guideStep4:
    'Cuando tengas un bloque de historias, entra a Tests y responde preguntas sobre lo aprendido.',
  guideStep5:
    'PancitoLandia es una partida libre. En Configuración cambias idioma, volumen y puedes reiniciar el progreso.',
  guideFooter: 'Si te pierdes, pulsa el botón ? en el menú y vuelve a ver esta guía.',
  startExploring: 'Empezar a explorar',

  pause: 'Pausar',
  skipToContent: 'Saltar al contenido',
  faceDownCard: 'Carta boca abajo',
  cardOf: 'Carta {n} de {total}',
  flippedCard: 'Volteada: {name}',
  pairMatched: 'Pareja: {name}',
  pairMissed: 'No coinciden',
  timeRunningOut: 'Quedan {n} segundos',
  announcedPaused: 'Partida en pausa',
  announcedResumed: 'Partida reanudada',
  announcedVictory: 'Nivel superado',
  announcedDefeat: 'Se acabó el tiempo',
  accessibility: 'Accesibilidad',
  timeAssist: 'Tiempo en los niveles',
  timeAssistDefault: 'Normal',
  timeAssistExtra: 'Más tiempo (+50%)',
  timeAssistUnlimited: 'Sin límite',
  timeAssistHelp:
    'Ayuda si el reloj te resulta corto. Solo afecta a los niveles con tiempo.',
  musicVolume: 'Volumen de música',
  effectsVolume: 'Volumen de efectos',
  matchedMark: 'Emparejada',
  missedMark: 'Fallida',
  memoryBoard: 'Tablero de memoria',
  atlasCount: '{a}/{b}',
  atlasRemaining: 'faltan {n}',
  stars: 'Estrellas',
} as const

const en: Record<keyof typeof es, string> = {
  play: 'Play',
  stories: 'Stories',
  settings: 'Settings',
  tests: 'Tests',
  achievements: 'Achievements',
  credits: 'Credits',
  freePlay: 'PancitoLandia',
  back: 'Back',
  close: 'Close',
  continue: 'Continue',
  next: 'Next',
  accept: 'Accept',
  cancel: 'Cancel',
  yes: 'Yes',
  no: 'No',

  levels: 'Levels',
  normal: 'Normal',
  hard: 'Hard',
  level: 'Level',
  cardsCount: '{n} cards',

  countries: 'Countries',
  chooseCountry: 'Choose a country',
  countryNotExported: 'not exported yet',
  deck: 'Deck',
  cardBack: 'Card back',
  sectionDefaultBack: 'Section default',

  section12: 'Beginner',
  section16: 'Explorer',
  section20: 'Historian',
  section24: 'Archaeologist',
  section28: 'Expedition',
  section32: 'Master',
  section40: 'Scholar',
  sectionLabel: '{name} Level · {n} cards',

  locked: 'Locked',
  completePrevious: 'Complete the previous level',
  starsOf: '{a} of {b}',

  time: 'Time',
  mistakes: 'Mistakes',
  pairs: 'Pairs',
  paused: 'Paused',
  restart: 'Restart',
  quit: 'Quit',
  memorize: 'Memorise',
  noLimit: 'No limit',
  confirmQuit: 'If you leave now, this round is lost.',
  confirmRestart: 'Start this round over?',
  matchInProgress: 'Round in progress',

  victory: 'Level complete!',
  defeat: "Time's up",
  yourTime: 'Your time',
  yourMistakes: 'Mistakes',
  tryAgain: 'Try again',
  toLevels: 'To levels',
  flawless: 'Flawless',
  wellDone: 'Well done',
  justInTime: 'Just in time',
  byTheSkin: 'By the skin of your teeth',
  nextTime: 'Next time',

  storyLocked: 'Win the level to discover it',
  storyNew: 'New',
  storiesRead: '{a} of {b} discovered',
  newStory: 'Story unlocked!',
  readStory: 'Read the story',
  continueWithoutReading: 'Continue',
  exLibris: 'Ex libris',
  viewImage: 'View image',

  sectionComplete: 'Section complete!',
  sectionCompleteFooter: 'You have closed this chapter of the book.',

  language: 'Language',
  music: 'Music',
  soundEffects: 'Sound effects',
  resetProgress: 'Reset progress',
  confirmResetProgress: 'Are you sure? All your stars and stories will be erased.',
  country: 'Country',

  test: 'Test',
  blockPreviousTest: 'Complete test {n} first',
  blockStories: 'Unlock stories {a} to {b}',
  blockFirstStories: 'Unlock the first {n} stories',
  testCompleted: 'Completed',
  yourScore: 'Your score',
  questionOf: 'Question {a} of {b}',
  scoreLow: 'Keep trying. Go back and read the stories.',
  scoreMedium: 'Good work. You are on the right track.',
  scoreHigh: 'Excellent. You almost know it all.',
  scorePerfect: 'Perfect! Not a single miss.',

  achievementUnlocked: 'Achievement unlocked',
  achievementProgressLabel: '{a} of {b}',

  cardCount: 'Cards',
  timeLimit: 'Time',
  openingGlance: 'Opening glance',
  startMatch: 'Start',

  chooseLanguage: 'Choose your language',
  termsTitle: 'Terms and conditions',
  termsHelp: 'Read the full document. You must accept it to continue.',
  termsAccept: 'I have read and accept the terms of use',
  welcome: 'Welcome to Memory History',
  skip: 'Skip',
  howToPlay: 'How to play',
  help: 'Help',
  guideStep1:
    'Above the title is the country. Tap it to switch (Venezuela, Spain, United States…). Each country keeps its own progress.',
  guideStep2:
    'Tap Play to pick a memory level. Match equal cards before time runs out.',
  guideStep3:
    'Winning a level can unlock a story. Read them anytime in Stories.',
  guideStep4:
    'When you have a block of stories, open Tests and answer questions about what you learned.',
  guideStep5:
    'PancitoLandia is a free match. In Settings you change language, volume, and can reset progress.',
  guideFooter: 'If you get stuck, tap the ? button on the menu to open this guide again.',
  startExploring: 'Start exploring',

  pause: 'Pause',
  skipToContent: 'Skip to content',
  faceDownCard: 'Face-down card',
  cardOf: 'Card {n} of {total}',
  flippedCard: 'Flipped: {name}',
  pairMatched: 'Match: {name}',
  pairMissed: 'No match',
  timeRunningOut: '{n} seconds left',
  announcedPaused: 'Match paused',
  announcedResumed: 'Match resumed',
  announcedVictory: 'Level complete',
  announcedDefeat: "Time's up",
  accessibility: 'Accessibility',
  timeAssist: 'Level timer',
  timeAssistDefault: 'Normal',
  timeAssistExtra: 'Extra time (+50%)',
  timeAssistUnlimited: 'No limit',
  timeAssistHelp: 'Helps if the clock feels short. Only affects timed campaign levels.',
  musicVolume: 'Music volume',
  effectsVolume: 'Effects volume',
  matchedMark: 'Matched',
  missedMark: 'Miss',
  memoryBoard: 'Memory board',
  atlasCount: '{a}/{b}',
  atlasRemaining: '{n} left',
  stars: 'Stars',
}

export const TEXTS = { es, en }

export type TextKey = keyof typeof es
export type Substitutions = Record<string, string | number>

export function translate(
  language: Language,
  key: TextKey,
  substitutions?: Substitutions,
): string {
  let text: string = TEXTS[language][key] ?? TEXTS.es[key] ?? key
  if (substitutions) {
    for (const [name, value] of Object.entries(substitutions)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export function useLanguage(): Language {
  return useSave((state) => state.settings.language)
}

export function useT() {
  const language = useLanguage()
  return (key: TextKey, substitutions?: Substitutions) =>
    translate(language, key, substitutions)
}
