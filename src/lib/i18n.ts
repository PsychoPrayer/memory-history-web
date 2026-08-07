import { useGuardado } from './almacen'
import type { Idioma } from '../tipos'

/**
 * Textos de interfaz.
 *
 * Unity resolvía esto de tres formas distintas a la vez: un diccionario en
 * código, cadenas serializadas en cada escena y campos duplicados en los
 * datos. Aquí solo hay una: este objeto. El contenido (historias, preguntas,
 * logros) sí conserva sus dos versiones porque viene así desde el exportador.
 */

const es = {
  // Menú
  jugar: 'Jugar',
  historias: 'Historias',
  ajustes: 'Configuración',
  tests: 'Tests',
  logros: 'Logros',
  creditos: 'Créditos',
  libre: 'PancitoLandia',
  volver: 'Volver',
  cerrar: 'Cerrar',
  continuar: 'Continuar',
  siguiente: 'Siguiente',
  aceptar: 'Aceptar',
  cancelar: 'Cancelar',
  si: 'Sí',
  no: 'No',

  // Selección de nivel
  niveles: 'Niveles',
  normales: 'Normales',
  dificiles: 'Difíciles',
  nivel: 'Nivel',
  cartasDe: '{n} cartas',

  // Nombres de sección del original, uno por tamaño de tablero.
  paises: 'Países',
  eligePais: 'Elige país',
  paisSinExportar: 'sin exportar todavía',
  baraja: 'Baraja',
  reverso: 'Reverso de las cartas',
  reversoDeLaSeccion: 'El de la sección',

  seccion12: 'Aprendiz',
  seccion16: 'Descubridor',
  seccion20: 'Historiador',
  seccion24: 'Arqueólogo',
  seccion28: 'Expedicionario',
  seccion32: 'Maestro',
  seccion40: 'Erudito',
  rotuloSeccion: 'Nivel {nombre} · {n} cartas',

  bloqueado: 'Bloqueado',
  completaAnterior: 'Completa el nivel anterior',
  estrellasDe: '{a} de {b}',

  // Partida
  tiempo: 'Tiempo',
  errores: 'Errores',
  parejas: 'Parejas',
  pausa: 'Pausa',
  reiniciar: 'Reiniciar',
  salir: 'Salir',
  memoriza: 'Memoriza',
  sinLimite: 'Sin límite',
  confirmarSalir: 'Si sales ahora, se pierde esta partida.',
  confirmarReinicio: '¿Empezar de nuevo esta partida?',
  partidaEnCurso: 'Partida en curso',

  // Resultado
  victoria: '¡Nivel superado!',
  derrota: 'Se acabó el tiempo',
  tuTiempo: 'Tu tiempo',
  tusErrores: 'Errores',
  reintentar: 'Reintentar',
  aNiveles: 'A los niveles',
  impecable: 'Impecable',
  muyBien: 'Muy bien',
  justoATiempo: 'Justo a tiempo',
  aDurasPenas: 'A duras penas',
  otraVez: 'Otra vez será',

  // Historias
  historiaBloqueada: 'Gana el nivel para descubrirla',
  historiaNueva: 'Nueva',
  historiasLeidas: '{a} de {b} descubiertas',
  nuevaHistoria: '¡Historia desbloqueada!',
  verHistoria: 'Leer la historia',
  seguirSinLeer: 'Seguir',
  exLibris: 'Ex libris',
  verImagen: 'Ver imagen',

  // Sección completada
  seccionCompletada: '¡Sección completada!',
  seccionCompletadaPie: 'Has cerrado este capítulo del libro.',

  // Configuración
  idioma: 'Idioma',
  musica: 'Música',
  efectos: 'Efectos',
  reiniciarProgreso: 'Reiniciar progreso',
  confirmarBorrarProgreso: '¿Seguro? Se borrarán todas tus estrellas e historias.',
  pais: 'País',

  // Tests y quiz
  test: 'Test',
  bloqueoTestAnterior: 'Completa antes el test {n}',
  bloqueoHistorias: 'Desbloquea las historias {a} a {b}',
  bloqueoPrimerasHistorias: 'Desbloquea las primeras {n} historias',
  testCompletado: 'Completado',
  tuNota: 'Tu nota',
  preguntaDe: 'Pregunta {a} de {b}',
  notaBaja: 'Sigue intentándolo. Vuelve a leer las historias.',
  notaMedia: 'Buen trabajo. Vas por buen camino.',
  notaAlta: 'Excelente. Casi te lo sabes todo.',
  notaPerfecta: '¡Perfecto! No has fallado ni una.',

  // Logros
  logroDesbloqueado: 'Logro desbloqueado',
  progresoLogro: '{a} de {b}',

  // PancitoLandia
  numeroDeCartas: 'Cartas',
  limiteDeTiempo: 'Tiempo',
  vistazoInicial: 'Vistazo inicial',
  empezarPartida: 'Empezar',

  // Onboarding
  eligeIdioma: 'Elige tu idioma',
  terminosTitulo: 'Términos y condiciones',
  terminosAyuda: 'Lee el documento completo. Debes aceptarlo para continuar.',
  terminos: 'He leído y acepto las condiciones de uso',
  bienvenida: 'Bienvenido a Memory History',
  saltar: 'Saltar',
  comoSeJuega: 'Cómo se juega',
  ayuda: 'Ayuda',
  guiaPaso1:
    'Arriba del título está el país. Tócalo para cambiar (Venezuela, España, Estados Unidos…). Cada país guarda su propio progreso.',
  guiaPaso2:
    'Pulsa Jugar para elegir un nivel de memoria. Empareja las cartas iguales antes de que se acabe el tiempo.',
  guiaPaso3:
    'Al ganar un nivel puedes desbloquear una historia. Léelas en Historias cuando quieras.',
  guiaPaso4:
    'Cuando tengas un bloque de historias, entra a Tests y responde preguntas sobre lo aprendido.',
  guiaPaso5:
    'PancitoLandia es una partida libre. En Configuración cambias idioma, volumen y puedes reiniciar el progreso.',
  guiaPie: 'Si te pierdes, pulsa el botón ? en el menú y vuelve a ver esta guía.',
  empezarAExplorar: 'Empezar a explorar',
} as const

const en: Record<keyof typeof es, string> = {
  jugar: 'Play',
  historias: 'Stories',
  ajustes: 'Settings',
  tests: 'Tests',
  logros: 'Achievements',
  creditos: 'Credits',
  libre: 'PancitoLandia',
  volver: 'Back',
  cerrar: 'Close',
  continuar: 'Continue',
  siguiente: 'Next',
  aceptar: 'Accept',
  cancelar: 'Cancel',
  si: 'Yes',
  no: 'No',

  niveles: 'Levels',
  normales: 'Normal',
  dificiles: 'Hard',
  nivel: 'Level',
  cartasDe: '{n} cards',

  paises: 'Countries',
  eligePais: 'Choose a country',
  paisSinExportar: 'not exported yet',
  baraja: 'Deck',
  reverso: 'Card back',
  reversoDeLaSeccion: 'Section default',

  seccion12: 'Beginner',
  seccion16: 'Explorer',
  seccion20: 'Historian',
  seccion24: 'Archaeologist',
  seccion28: 'Expedition',
  seccion32: 'Master',
  seccion40: 'Scholar',
  rotuloSeccion: '{nombre} Level · {n} cards',

  bloqueado: 'Locked',
  completaAnterior: 'Complete the previous level',
  estrellasDe: '{a} of {b}',

  tiempo: 'Time',
  errores: 'Mistakes',
  parejas: 'Pairs',
  pausa: 'Paused',
  reiniciar: 'Restart',
  salir: 'Quit',
  memoriza: 'Memorise',
  sinLimite: 'No limit',
  confirmarSalir: 'If you leave now, this round is lost.',
  confirmarReinicio: 'Start this round over?',
  partidaEnCurso: 'Round in progress',

  victoria: 'Level complete!',
  derrota: "Time's up",
  tuTiempo: 'Your time',
  tusErrores: 'Mistakes',
  reintentar: 'Try again',
  aNiveles: 'To levels',
  impecable: 'Flawless',
  muyBien: 'Well done',
  justoATiempo: 'Just in time',
  aDurasPenas: 'By the skin of your teeth',
  otraVez: 'Next time',

  historiaBloqueada: 'Win the level to discover it',
  historiaNueva: 'New',
  historiasLeidas: '{a} of {b} discovered',
  nuevaHistoria: 'Story unlocked!',
  verHistoria: 'Read the story',
  seguirSinLeer: 'Continue',
  exLibris: 'Ex libris',
  verImagen: 'View image',

  seccionCompletada: 'Section complete!',
  seccionCompletadaPie: 'You have closed this chapter of the book.',

  idioma: 'Language',
  musica: 'Music',
  efectos: 'Sound effects',
  reiniciarProgreso: 'Reset progress',
  confirmarBorrarProgreso: 'Are you sure? All your stars and stories will be erased.',
  pais: 'Country',

  test: 'Test',
  bloqueoTestAnterior: 'Complete test {n} first',
  bloqueoHistorias: 'Unlock stories {a} to {b}',
  bloqueoPrimerasHistorias: 'Unlock the first {n} stories',
  testCompletado: 'Completed',
  tuNota: 'Your score',
  preguntaDe: 'Question {a} of {b}',
  notaBaja: 'Keep trying. Go back and read the stories.',
  notaMedia: 'Good work. You are on the right track.',
  notaAlta: 'Excellent. You almost know it all.',
  notaPerfecta: 'Perfect! Not a single miss.',

  logroDesbloqueado: 'Achievement unlocked',
  progresoLogro: '{a} of {b}',

  numeroDeCartas: 'Cards',
  limiteDeTiempo: 'Time',
  vistazoInicial: 'Opening glance',
  empezarPartida: 'Start',

  eligeIdioma: 'Choose your language',
  terminosTitulo: 'Terms and conditions',
  terminosAyuda: 'Read the full document. You must accept it to continue.',
  terminos: 'I have read and accept the terms of use',
  bienvenida: 'Welcome to Memory History',
  saltar: 'Skip',
  comoSeJuega: 'How to play',
  ayuda: 'Help',
  guiaPaso1:
    'Above the title is the country. Tap it to switch (Venezuela, Spain, United States…). Each country keeps its own progress.',
  guiaPaso2:
    'Tap Play to pick a memory level. Match equal cards before time runs out.',
  guiaPaso3:
    'Winning a level can unlock a story. Read them anytime in Stories.',
  guiaPaso4:
    'When you have a block of stories, open Tests and answer questions about what you learned.',
  guiaPaso5:
    'PancitoLandia is a free match. In Settings you change language, volume, and can reset progress.',
  guiaPie: 'If you get stuck, tap the ? button on the menu to open this guide again.',
  empezarAExplorar: 'Start exploring',
}

export const TEXTOS = { es, en }

export type ClaveTexto = keyof typeof es
export type Sustituciones = Record<string, string | number>

export function traducir(
  idioma: Idioma,
  clave: ClaveTexto,
  sustituciones?: Sustituciones,
): string {
  let texto: string = TEXTOS[idioma][clave] ?? TEXTOS.es[clave] ?? clave
  if (sustituciones) {
    for (const [nombre, valor] of Object.entries(sustituciones)) {
      texto = texto.replaceAll(`{${nombre}}`, String(valor))
    }
  }
  return texto
}

export function useIdioma(): Idioma {
  return useGuardado((estado) => estado.ajustes.idioma)
}

/** Devuelve la función de traducción ligada al idioma activo. */
export function useTexto() {
  const idioma = useIdioma()
  return (clave: ClaveTexto, sustituciones?: Sustituciones) =>
    traducir(idioma, clave, sustituciones)
}
