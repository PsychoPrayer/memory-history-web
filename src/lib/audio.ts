import { readState } from './save'

export type Track = 'intro' | 'game'

export type SoundEffect =
  | 'card'
  | 'button'
  | 'transition'
  | 'victory'
  | 'defeat'
  | 'section'
  | 'match'
  | 'miss'
  | 'star'
  | 'urgency'

const MUSIC: Record<Track, string> = {
  intro: '/audio/MusicaLogin.mp3',
  game: '/audio/MusicaJuegoVenezuela.mp3',
}

const FILES: Partial<Record<SoundEffect, string>> = {
  card: '/audio/Carta.mp3',
  section: '/audio/EndVictory.mp3',
}

/** Skip leading silence baked into the Unity MP3 exports. */
const FILE_START_OFFSET: Partial<Record<SoundEffect, number>> = {
  card: 0.02,
}

let context: AudioContext | null = null
let enabled = false
const buffers = new Map<string, AudioBuffer>()
const bufferLoads = new Map<string, Promise<AudioBuffer | null>>()

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!context) {
    const Constructor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Constructor) return null
    context = new Constructor()
  }
  if (context.state === 'suspended') void context.resume()
  return context
}

async function loadBuffer(path: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(path)
  if (cached) return cached

  const pending = bufferLoads.get(path)
  if (pending) return pending

  const load = (async () => {
    try {
      const response = await fetch(path)
      if (!response.ok) return null
      const raw = await response.arrayBuffer()
      const ctx = audioContext()
      if (!ctx) return null
      const buffer = await ctx.decodeAudioData(raw.slice(0))
      buffers.set(path, buffer)
      return buffer
    } catch {
      return null
    } finally {
      bufferLoads.delete(path)
    }
  })()

  bufferLoads.set(path, load)
  return load
}

function playBuffer(buffer: AudioBuffer, volume: number, offset = 0) {
  const ctx = audioContext()
  if (!ctx) return

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const gain = ctx.createGain()
  gain.gain.value = Math.max(0, Math.min(1, volume))

  source.connect(gain).connect(ctx.destination)
  const startAt = Math.min(Math.max(0, offset), Math.max(0, buffer.duration - 0.01))
  source.start(0, startAt)
}

function warmEffectFiles() {
  for (const path of Object.values(FILES)) {
    if (path) void loadBuffer(path)
  }
}

export function unlockAudio() {
  if (enabled) return
  enabled = true
  audioContext()
  warmEffectFiles()
  if (pendingTrack) {
    const track = pendingTrack
    pendingTrack = null
    playMusic(track)
  }
}

function musicVolume() {
  const settings = readState().settings
  if (settings.muted) return 0
  return settings.musicVolume
}

function effectsVolume() {
  const settings = readState().settings
  if (settings.muted) return 0
  return settings.effectsVolume
}

export function isMuted() {
  return Boolean(readState().settings.muted)
}

/** Call after toggling `settings.muted` so looping music updates immediately. */
export function syncMuteToMusic(forcedMuted?: boolean) {
  if (!musicElement) return
  const muted = forcedMuted ?? isMuted()
  if (muted) {
    musicElement.volume = 0
    musicElement.pause()
    return
  }
  musicElement.volume = appliedMusicVolume()
  if (musicElement.paused && enabled) {
    void musicElement.play().catch(() => {
      /* autoplay blocked until next gesture */
    })
  }
}

let musicElement: HTMLAudioElement | null = null
let currentSource: string | null = null
let pendingTrack: Track | null = null
let matchDim = 1

function appliedMusicVolume() {
  return Math.min(1, Math.max(0, musicVolume() * 0.85 * matchDim))
}

function stopElement(element: HTMLAudioElement | null) {
  if (!element) return
  element.pause()
  element.loop = false
  element.src = ''
  element.load()
}

export function playMusic(track: Track) {
  if (typeof Audio === 'undefined') return
  if (!enabled) {
    pendingTrack = track
    return
  }
  const source = MUSIC[track]
  if (currentSource === source && musicElement) {
    musicElement.volume = appliedMusicVolume()
    if (isMuted()) {
      musicElement.pause()
      return
    }
    if (!musicElement.paused) return
    void musicElement.play().catch(() => {
      pendingTrack = track
    })
    return
  }

  stopMusic()
  const element = new Audio(source)
  element.loop = true
  element.volume = appliedMusicVolume()
  musicElement = element
  currentSource = source

  /* iOS ignores HTMLAudioElement.volume — pause instead of “silent” play. */
  if (isMuted() || appliedMusicVolume() <= 0) {
    return
  }

  void element.play().catch(() => {
    pendingTrack = track
  })
}

export function dimMusicInMatch(active: boolean) {
  matchDim = active ? 0.5 : 1
  if (!musicElement) return
  if (isMuted()) {
    musicElement.volume = 0
    musicElement.pause()
    return
  }
  musicElement.volume = appliedMusicVolume()
}

export function stopMusic() {
  stopElement(musicElement)
  musicElement = null
  currentSource = null
}

export function setMusicVolume(value: number) {
  if (!musicElement) return
  if (isMuted()) {
    musicElement.volume = 0
    musicElement.pause()
    return
  }
  musicElement.volume = Math.min(1, Math.max(0, value * 0.85 * matchDim))
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => stopMusic())
}

interface Tone {
  from: number
  to?: number
  duration: number
  type?: OscillatorType
  volume?: number
  delay?: number
}

function tone({ from, to, duration, type = 'sine', volume = 1, delay = 0 }: Tone) {
  const ctx = audioContext()
  if (!ctx) return

  const start = ctx.currentTime + delay
  const end = start + duration

  const oscillator = ctx.createOscillator()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(from, start)
  if (to !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), end)

  const gain = ctx.createGain()
  const peak = Math.max(0.0001, volume * effectsVolume() * 0.28)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(end + 0.02)
}

function noiseBurst(volume = 1) {
  const ctx = audioContext()
  if (!ctx) return

  const duration = 0.18
  const samples = Math.floor(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < samples; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 3
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900

  const gain = ctx.createGain()
  gain.gain.value = volume * effectsVolume() * 0.4

  source.connect(filter).connect(gain).connect(ctx.destination)
  source.start()
}

const SYNTHESIZED: Partial<Record<SoundEffect, () => void>> = {
  /** Same family as menu navigation — Web Audio, no MP3 decode lag. */
  button: () => {
    tone({ from: 520, to: 780, duration: 0.09, type: 'sine', volume: 0.45 })
    tone({ from: 780, to: 520, duration: 0.1, type: 'triangle', volume: 0.25, delay: 0.04 })
  },
  transition: () => {
    tone({ from: 520, to: 780, duration: 0.09, type: 'sine', volume: 0.45 })
    tone({ from: 780, to: 520, duration: 0.1, type: 'triangle', volume: 0.25, delay: 0.04 })
  },
  victory: () => {
    tone({ from: 523.25, duration: 0.12, type: 'triangle', volume: 0.85 })
    tone({ from: 659.25, duration: 0.12, type: 'triangle', volume: 0.8, delay: 0.1 })
    tone({ from: 783.99, duration: 0.22, type: 'triangle', volume: 0.9, delay: 0.2 })
  },
  defeat: () => {
    tone({ from: 392, to: 294, duration: 0.22, type: 'sine', volume: 0.7 })
    tone({ from: 294, to: 220, duration: 0.28, type: 'sine', volume: 0.55, delay: 0.14 })
  },
  match: () => {
    tone({ from: 660, duration: 0.1, type: 'triangle', volume: 0.8 })
    tone({ from: 990, duration: 0.16, type: 'triangle', volume: 0.7, delay: 0.07 })
  },
  miss: () => {
    noiseBurst(0.9)
    tone({ from: 200, to: 120, duration: 0.2, type: 'sine', volume: 0.6 })
  },
  star: () => {
    tone({ from: 1320, duration: 0.28, type: 'sine', volume: 0.9 })
    tone({ from: 1980, duration: 0.22, type: 'sine', volume: 0.35, delay: 0.03 })
  },
  urgency: () => {
    tone({ from: 880, duration: 0.07, type: 'square', volume: 0.35 })
  },
}

function playFileEffect(effect: SoundEffect, path: string) {
  const volume = effectsVolume()
  const offset = FILE_START_OFFSET[effect] ?? 0
  const ready = buffers.get(path)
  if (ready) {
    playBuffer(ready, volume, offset)
    return
  }

  // First tap after unlock: decode then play; later taps hit the cache.
  void loadBuffer(path).then((buffer) => {
    if (buffer) playBuffer(buffer, volume, offset)
  })
}

export function playSound(effect: SoundEffect) {
  if (!enabled) return
  if (isMuted() || effectsVolume() <= 0) return

  const file = FILES[effect]
  if (file) {
    playFileEffect(effect, file)
    return
  }
  SYNTHESIZED[effect]?.()
}

export function playStarSound(count: number) {
  if (isMuted() || effectsVolume() <= 0) return
  for (let i = 0; i < count; i += 1) {
    if (!audioContext()) return
    tone({
      from: 1046 * (1 + i * 0.26),
      duration: 0.3,
      type: 'sine',
      volume: 0.9,
      delay: 0.18 * i,
    })
  }
}
