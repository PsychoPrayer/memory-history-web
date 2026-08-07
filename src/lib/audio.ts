import { leerEstado } from './almacen'

/**
 * Música y efectos.
 *
 * La música de fondo es la del Unity original. Los clics de UI, victoria,
 * derrota y transición se sintetizan aquí: tonos cortos, genéricos.
 * Solo se conservan del original los SFX que encajan (volteo, botón, sección).
 */

export type Pista = 'intro' | 'juego'

export type Efecto =
  | 'carta'
  | 'boton'
  | 'transicion'
  | 'victoria'
  | 'derrota'
  | 'seccion'
  | 'acierto'
  | 'fallo'
  | 'estrella'
  | 'apremio'

const MUSICA: Record<Pista, string> = {
  intro: '/audio/MusicaLogin.mp3',
  juego: '/audio/MusicaJuegoVenezuela.mp3',
}

/** Solo los efectos que aún merecen el archivo original. */
const ARCHIVOS: Partial<Record<Efecto, string>> = {
  carta: '/audio/Carta.mp3',
  boton: '/audio/BotonNormal.mp3',
  seccion: '/audio/EndVictory.mp3',
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

let contexto: AudioContext | null = null
let habilitado = false

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!contexto) {
    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Constructor) return null
    contexto = new Constructor()
  }
  if (contexto.state === 'suspended') void contexto.resume()
  return contexto
}

export function desbloquearAudio() {
  if (habilitado) return
  habilitado = true
  ctx()
  if (pistaPendiente) {
    const pista = pistaPendiente
    pistaPendiente = null
    reproducirMusica(pista)
  }
}

function volumenMusica() {
  return leerEstado().ajustes.volumenMusica
}

function volumenEfectos() {
  return leerEstado().ajustes.volumenEfectos
}

// ---------------------------------------------------------------------------
// Música
// ---------------------------------------------------------------------------

let elementoMusica: HTMLAudioElement | null = null
let fuenteActual: string | null = null
let pistaPendiente: Pista | null = null
/** En partida baja a la mitad para no tapar el tablero. */
let atenuacionPartida = 1

function volumenMusicaAplicado() {
  return Math.min(1, Math.max(0, volumenMusica() * 0.85 * atenuacionPartida))
}

function detenerElemento(elemento: HTMLAudioElement | null) {
  if (!elemento) return
  elemento.pause()
  elemento.loop = false
  elemento.src = ''
  elemento.load()
}

export function reproducirMusica(pista: Pista) {
  if (typeof Audio === 'undefined') return
  if (!habilitado) {
    pistaPendiente = pista
    return
  }
  const fuente = MUSICA[pista]
  if (fuenteActual === fuente && elementoMusica && !elementoMusica.paused) {
    elementoMusica.volume = volumenMusicaAplicado()
    return
  }

  pararMusica()
  const elemento = new Audio(fuente)
  elemento.loop = true
  elemento.volume = volumenMusicaAplicado()

  void elemento.play().catch(() => {
    pistaPendiente = pista
  })
  elementoMusica = elemento
  fuenteActual = fuente
}

/** Mitad de volumen mientras se juega un nivel; volumen normal fuera. */
export function atenuarMusicaEnPartida(activo: boolean) {
  atenuacionPartida = activo ? 0.5 : 1
  if (elementoMusica) elementoMusica.volume = volumenMusicaAplicado()
}

export function pararMusica() {
  detenerElemento(elementoMusica)
  elementoMusica = null
  fuenteActual = null
}

export function ajustarVolumenMusica(valor: number) {
  if (elementoMusica) {
    elementoMusica.volume = Math.min(1, Math.max(0, valor * 0.85 * atenuacionPartida))
  }
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => pararMusica())
}

// ---------------------------------------------------------------------------
// Efectos con archivo
// ---------------------------------------------------------------------------

const precargados = new Map<string, HTMLAudioElement>()

function reproducirArchivo(ruta: string, volumen: number) {
  let base = precargados.get(ruta)
  if (!base) {
    base = new Audio(ruta)
    base.preload = 'auto'
    precargados.set(ruta, base)
  }
  const copia = base.cloneNode() as HTMLAudioElement
  copia.volume = volumen
  void copia.play().catch(() => {})
}

// ---------------------------------------------------------------------------
// Efectos sintetizados
// ---------------------------------------------------------------------------

interface Tono {
  de: number
  a?: number
  duracion: number
  tipo?: OscillatorType
  volumen?: number
  retraso?: number
}

function tono({ de, a, duracion, tipo = 'sine', volumen = 1, retraso = 0 }: Tono) {
  const contexto = ctx()
  if (!contexto) return

  const inicio = contexto.currentTime + retraso
  const fin = inicio + duracion

  const oscilador = contexto.createOscillator()
  oscilador.type = tipo
  oscilador.frequency.setValueAtTime(de, inicio)
  if (a !== undefined) oscilador.frequency.exponentialRampToValueAtTime(Math.max(1, a), fin)

  const ganancia = contexto.createGain()
  const pico = Math.max(0.0001, volumen * volumenEfectos() * 0.28)
  ganancia.gain.setValueAtTime(0.0001, inicio)
  ganancia.gain.exponentialRampToValueAtTime(pico, inicio + 0.012)
  ganancia.gain.exponentialRampToValueAtTime(0.0001, fin)

  oscilador.connect(ganancia).connect(contexto.destination)
  oscilador.start(inicio)
  oscilador.stop(fin + 0.02)
}

function golpe(volumen = 1) {
  const contexto = ctx()
  if (!contexto) return

  const duracion = 0.18
  const muestras = Math.floor(contexto.sampleRate * duracion)
  const buffer = contexto.createBuffer(1, muestras, contexto.sampleRate)
  const datos = buffer.getChannelData(0)
  for (let i = 0; i < muestras; i += 1) {
    datos[i] = (Math.random() * 2 - 1) * (1 - i / muestras) ** 3
  }

  const fuente = contexto.createBufferSource()
  fuente.buffer = buffer

  const filtro = contexto.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 900

  const ganancia = contexto.createGain()
  ganancia.gain.value = volumen * volumenEfectos() * 0.4

  fuente.connect(filtro).connect(ganancia).connect(contexto.destination)
  fuente.start()
}

const SINTETIZADOS: Partial<Record<Efecto, () => void>> = {
  // Pop suave al cambiar de pantalla. Genérico, sin papel.
  transicion: () => {
    tono({ de: 520, a: 780, duracion: 0.09, tipo: 'sine', volumen: 0.45 })
    tono({ de: 780, a: 520, duracion: 0.1, tipo: 'triangle', volumen: 0.25, retraso: 0.04 })
  },
  // Tres notas alegres, cortas: “¡bien!”.
  victoria: () => {
    tono({ de: 523.25, duracion: 0.12, tipo: 'triangle', volumen: 0.85 })
    tono({ de: 659.25, duracion: 0.12, tipo: 'triangle', volumen: 0.8, retraso: 0.1 })
    tono({ de: 783.99, duracion: 0.22, tipo: 'triangle', volumen: 0.9, retraso: 0.2 })
  },
  // Dos notas que bajan un poco, sin drama.
  derrota: () => {
    tono({ de: 392, a: 294, duracion: 0.22, tipo: 'sine', volumen: 0.7 })
    tono({ de: 294, a: 220, duracion: 0.28, tipo: 'sine', volumen: 0.55, retraso: 0.14 })
  },
  acierto: () => {
    tono({ de: 660, duracion: 0.1, tipo: 'triangle', volumen: 0.8 })
    tono({ de: 990, duracion: 0.16, tipo: 'triangle', volumen: 0.7, retraso: 0.07 })
  },
  fallo: () => {
    golpe(0.9)
    tono({ de: 200, a: 120, duracion: 0.2, tipo: 'sine', volumen: 0.6 })
  },
  estrella: () => {
    tono({ de: 1320, duracion: 0.28, tipo: 'sine', volumen: 0.9 })
    tono({ de: 1980, duracion: 0.22, tipo: 'sine', volumen: 0.35, retraso: 0.03 })
  },
  apremio: () => {
    tono({ de: 880, duracion: 0.07, tipo: 'square', volumen: 0.35 })
  },
}

export function sonar(efecto: Efecto) {
  if (!habilitado) return
  if (volumenEfectos() <= 0) return

  const archivo = ARCHIVOS[efecto]
  if (archivo) {
    reproducirArchivo(archivo, volumenEfectos())
    return
  }
  SINTETIZADOS[efecto]?.()
}

export function sonarEstrellas(cuantas: number) {
  for (let i = 0; i < cuantas; i += 1) {
    const contexto = ctx()
    if (!contexto) return
    tono({
      de: 1046 * (1 + i * 0.26),
      duracion: 0.3,
      tipo: 'sine',
      volumen: 0.9,
      retraso: 0.18 * i,
    })
  }
}
