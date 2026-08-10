import { useSyncExternalStore } from 'react'
import type { FreeDeck, CountryCode, Stars, Language } from '../types'

const STORAGE_KEY = 'memoryhistory.guardado'
const VERSION = 1

export interface LevelRecord {
  stars: Stars
  bestTime: number
  fewestMistakes: number
}

export interface TestRecord {
  completed: boolean
  bestScore: number
}

export interface CountryProgress {
  levels: Record<string, LevelRecord>
  storiesRead: string[]
  rewardsShown: string[]
  sectionsCelebrated: number[]
  tests: Record<string, TestRecord>
  achievements: Record<string, number>
}

/** Campaign timer help for accessibility (WCAG 2.2.1). */
export type TimeAssist = 'default' | 'extra' | 'unlimited'

export interface SettingsData {
  language: Language
  country: CountryCode
  musicVolume: number
  effectsVolume: number
  /** Silence music and effects without changing saved volume sliders. */
  muted: boolean
  timeAssist: TimeAssist
  languageChosen: boolean
  termsAccepted: boolean
  /** First-run meet-Pancito modal completed. */
  pancitoMet: boolean
  guideSeen: boolean
  /** Dismissed Pancito tip ids (e.g. menu-country, levels-next). */
  tipsSeen: string[]
  /** Local player display name (menu + profile). */
  playerName: string
  /** Avatar id from `lib/avatars` (pl:… or ui:…). */
  avatarId: string
  /** Name + avatar chosen at least once. */
  profileSetupDone: boolean
}

export interface FreeSettings {
  cards: number
  seconds: number
  peek: boolean
  deck: FreeDeck
  back: string | null
}

export interface SavedState {
  version: number
  /** Epoch ms; used to prefer newer settings when merging cloud saves. */
  updatedAt: number
  settings: SettingsData
  free: FreeSettings
  countries: Record<string, CountryProgress>
}

const EMPTY_PROGRESS: CountryProgress = {
  levels: {},
  storiesRead: [],
  rewardsShown: [],
  sectionsCelebrated: [],
  tests: {},
  achievements: {},
}
Object.freeze(EMPTY_PROGRESS)

function emptyProgress(): CountryProgress {
  return EMPTY_PROGRESS
}

function browserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'es'
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function initialState(): SavedState {
  return {
    version: VERSION,
    updatedAt: Date.now(),
    settings: {
      language: browserLanguage(),
      country: 'VE',
      musicVolume: 0.6,
      effectsVolume: 0.8,
      muted: false,
      timeAssist: 'default',
      languageChosen: false,
      termsAccepted: false,
      pancitoMet: false,
      guideSeen: false,
      tipsSeen: [],
      playerName: '',
      avatarId: 'ui:happy',
      profileSetupDone: false,
    },
    free: {
      cards: 16,
      seconds: 0,
      peek: true,
      deck: 'PL',
      back: null,
    },
    countries: {},
  }
}

/** Migrate legacy Spanish-keyed save blobs. */
function migrate(raw: Record<string, unknown>): SavedState {
  const base = initialState()

  if (raw.ajustes && typeof raw.ajustes === 'object') {
    const old = raw.ajustes as Record<string, unknown>
    base.settings = {
      language: (old.idioma as Language) ?? base.settings.language,
      country: (old.pais as CountryCode) ?? base.settings.country,
      musicVolume: (old.volumenMusica as number) ?? base.settings.musicVolume,
      effectsVolume: (old.volumenEfectos as number) ?? base.settings.effectsVolume,
      muted: Boolean(old.silenciado ?? old.muted),
      timeAssist: base.settings.timeAssist,
      languageChosen: (old.idiomaElegido as boolean) ?? base.settings.languageChosen,
      termsAccepted: (old.terminosAceptados as boolean) ?? base.settings.termsAccepted,
      guideSeen: (old.guiaVista as boolean) ?? base.settings.guideSeen,
      /* Returning players already past onboarding skip the meet modal. */
      pancitoMet: Boolean(old.guiaVista),
      tipsSeen: base.settings.tipsSeen,
      playerName: '',
      avatarId: 'ui:happy',
      /* Legacy saves: ask once for avatar/name. */
      profileSetupDone: false,
    }
  } else if (raw.settings && typeof raw.settings === 'object') {
    const incoming = raw.settings as Partial<SettingsData>
    const guideSeen = incoming.guideSeen ?? base.settings.guideSeen
    base.settings = {
      ...base.settings,
      ...incoming,
      timeAssist: incoming.timeAssist ?? base.settings.timeAssist,
      guideSeen,
      pancitoMet:
        typeof incoming.pancitoMet === 'boolean'
          ? incoming.pancitoMet
          : guideSeen,
      tipsSeen: Array.isArray(incoming.tipsSeen)
        ? incoming.tipsSeen
        : base.settings.tipsSeen,
      playerName:
        typeof incoming.playerName === 'string'
          ? incoming.playerName
          : base.settings.playerName,
      avatarId:
        typeof incoming.avatarId === 'string'
          ? incoming.avatarId
          : base.settings.avatarId,
      profileSetupDone: Boolean(
        incoming.profileSetupDone ??
          (typeof incoming.playerName === 'string' &&
            incoming.playerName.trim().length >= 2),
      ),
      muted: Boolean(incoming.muted),
    }
  }

  if (raw.libre && typeof raw.libre === 'object') {
    const old = raw.libre as Record<string, unknown>
    base.free = {
      cards: (old.cartas as number) ?? base.free.cards,
      seconds: (old.segundos as number) ?? base.free.seconds,
      peek: (old.vistazo as boolean) ?? base.free.peek,
      deck: (old.baraja as FreeDeck) ?? base.free.deck,
      back: (old.reverso as string | null) ?? base.free.back,
    }
  } else if (raw.free && typeof raw.free === 'object') {
    base.free = { ...base.free, ...(raw.free as FreeSettings) }
  }

  const countriesRaw = (raw.paises ?? raw.countries) as
    | Record<string, Record<string, unknown>>
    | undefined

  if (countriesRaw) {
    for (const [code, progress] of Object.entries(countriesRaw)) {
      base.countries[code] = {
        levels: migrateLevelRecords(progress.niveles ?? progress.levels),
        storiesRead: (progress.historiasLeidas ?? progress.storiesRead ?? []) as string[],
        rewardsShown: (progress.recompensasMostradas ?? progress.rewardsShown ?? []) as string[],
        sectionsCelebrated: (progress.seccionesCelebradas ??
          progress.sectionsCelebrated ??
          []) as number[],
        tests: migrateTestRecords(progress.tests),
        achievements: (progress.logros ?? progress.achievements ?? {}) as Record<string, number>,
      }
    }
  }

  if (typeof raw.updatedAt === 'number') base.updatedAt = raw.updatedAt
  else base.updatedAt = Date.now()

  return base
}

function migrateLevelRecords(
  raw: unknown,
): Record<string, LevelRecord> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, LevelRecord> = {}
  for (const [id, record] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    out[id] = {
      stars: (record.estrellas ?? record.stars ?? 0) as Stars,
      bestTime: (record.mejorTiempo ?? record.bestTime ?? 0) as number,
      fewestMistakes: (record.menosErrores ?? record.fewestMistakes ?? 0) as number,
    }
  }
  return out
}

function migrateTestRecords(raw: unknown): Record<string, TestRecord> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, TestRecord> = {}
  for (const [id, record] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    out[id] = {
      completed: (record.completado ?? record.completed ?? false) as boolean,
      bestScore: (record.mejorNota ?? record.bestScore ?? 0) as number,
    }
  }
  return out
}

let state: SavedState = load()
const listeners = new Set<() => void>()

function load(): SavedState {
  if (typeof localStorage === 'undefined') return initialState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState()
    return migrate(JSON.parse(raw) as Record<string, unknown>)
  } catch {
    return initialState()
  }
}

let suppressCloudSync = false

function persist() {
  state = { ...state, updatedAt: Date.now() }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Private browsing or quota full: match continues, just won't save.
  }
  if (!suppressCloudSync) syncHandler?.(state)
  for (const listener of listeners) listener()
}

type SyncHandler = (state: SavedState) => void
let syncHandler: SyncHandler | null = null

export function registerSync(fn: SyncHandler | null) {
  syncHandler = fn
}

export function readState(): SavedState {
  return state
}

/** Replace local save (e.g. after cloud merge) without pushing back to the cloud. */
export function hydrateState(next: SavedState, options?: { syncCloud?: boolean }) {
  state = migrate(next as unknown as Record<string, unknown>)
  suppressCloudSync = !options?.syncCloud
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
  for (const listener of listeners) listener()
  suppressCloudSync = false
  if (options?.syncCloud) syncHandler?.(state)
}

export function update(change: (previous: SavedState) => SavedState) {
  state = change(state)
  persist()
}

export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useSave<T>(selector: (state: SavedState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  )
}

export function setSetting<C extends keyof SettingsData>(key: C, value: SettingsData[C]) {
  update((previous) => ({
    ...previous,
    settings: { ...previous.settings, [key]: value },
  }))
}

/** Persist that a Pancito tip was dismissed. */
export function markTipSeen(tipId: string) {
  update((previous) => {
    const seen = previous.settings.tipsSeen ?? []
    if (seen.includes(tipId)) return previous
    return {
      ...previous,
      settings: {
        ...previous.settings,
        tipsSeen: [...seen, tipId],
      },
    }
  })
}

export function setFreeSettings(change: Partial<FreeSettings>) {
  update((previous) => ({ ...previous, free: { ...previous.free, ...change } }))
}

export function progressFor(country: CountryCode): CountryProgress {
  return state.countries[country] ?? emptyProgress()
}

function withProgress(
  country: CountryCode,
  change: (progress: CountryProgress) => CountryProgress,
) {
  update((previous) => ({
    ...previous,
    countries: {
      ...previous.countries,
      [country]: change(previous.countries[country] ?? emptyProgress()),
    },
  }))
}

export function recordVictory(country: CountryCode, levelId: string, record: LevelRecord) {
  withProgress(country, (progress) => {
    const previous = progress.levels[levelId]
    const best: LevelRecord = previous
      ? {
          stars: Math.max(previous.stars, record.stars) as Stars,
          bestTime: Math.min(previous.bestTime, record.bestTime),
          fewestMistakes: Math.min(previous.fewestMistakes, record.fewestMistakes),
        }
      : record
    return { ...progress, levels: { ...progress.levels, [levelId]: best } }
  })
}

export function markStoryRead(country: CountryCode, storyId: string) {
  withProgress(country, (progress) =>
    progress.storiesRead.includes(storyId)
      ? progress
      : { ...progress, storiesRead: [...progress.storiesRead, storyId] },
  )
}

export function markRewardShown(country: CountryCode, storyId: string) {
  withProgress(country, (progress) =>
    progress.rewardsShown.includes(storyId)
      ? progress
      : { ...progress, rewardsShown: [...progress.rewardsShown, storyId] },
  )
}

export function markSectionCelebrated(country: CountryCode, cards: number) {
  withProgress(country, (progress) =>
    progress.sectionsCelebrated.includes(cards)
      ? progress
      : { ...progress, sectionsCelebrated: [...progress.sectionsCelebrated, cards] },
  )
}

export function recordTest(country: CountryCode, level: number, score: number) {
  withProgress(country, (progress) => {
    const key = String(level)
    const previous = progress.tests[key]
    return {
      ...progress,
      tests: {
        ...progress.tests,
        [key]: {
          completed: true,
          bestScore: Math.max(previous?.bestScore ?? 0, score),
        },
      },
    }
  })
}

export function recordAchievements(
  country: CountryCode,
  achievementProgress: Record<string, number>,
) {
  withProgress(country, (progress) => ({
    ...progress,
    achievements: { ...progress.achievements, ...achievementProgress },
  }))
}

export function clearProgress(country: CountryCode) {
  update((previous) => {
    const countries = { ...previous.countries }
    delete countries[country]
    return { ...previous, countries }
  })
}
