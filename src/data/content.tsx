import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type {
  FreeDeck,
  CardCatalog,
  CountryCode,
  CountryContent,
  Story,
  Achievement,
  SectionMessage,
  Level,
  Country,
  Question,
  Test,
} from '../types'

const MODULES = import.meta.glob<{ default: unknown }>('../content/**/*.json')

export const COUNTRIES: readonly CountryCode[] = ['VE', 'ES', 'EU']

export const COUNTRY_NAME: Record<CountryCode, string> = {
  VE: 'Venezuela',
  ES: 'España',
  EU: 'Estados Unidos',
}

export function countryAvailable(code: CountryCode): boolean {
  return `../content/${code.toLowerCase()}/country.json` in MODULES
}

async function loadFile<T>(country: string, name: string): Promise<T> {
  const path = `../content/${country}/${name}.json`
  const loader = MODULES[path]
  if (!loader) {
    throw new Error(
      `Missing ${path}. Run "npm run content" to export it from Unity.`,
    )
  }
  const module = await loader()
  return module.default as T
}

const cache = new Map<CountryCode, Promise<CountryContent>>()

export function loadContent(code: CountryCode): Promise<CountryContent> {
  const cached = cache.get(code)
  if (cached) return cached

  const folder = code.toLowerCase()
  const promise = Promise.all([
    loadFile<Country>(folder, 'country'),
    loadFile<CardCatalog[]>(folder, 'cards'),
    loadFile<Level[]>(folder, 'levels'),
    loadFile<Story[]>(folder, 'stories'),
    loadFile<Question[]>(folder, 'questions'),
    loadFile<Test[]>(folder, 'tests'),
    loadFile<Achievement[]>(folder, 'achievements'),
    loadFile<SectionMessage[]>(folder, 'sections'),
  ]).then(
    ([country, cards, levels, stories, questions, tests, achievements, sections]) => ({
      country,
      cards,
      levels,
      stories,
      questions,
      tests,
      achievements,
      sections,
    }),
  )

  cache.set(code, promise)
  return promise
}

export const DECKS: readonly FreeDeck[] = [...COUNTRIES, 'PL']

export const DECK_NAME: Record<FreeDeck, string> = {
  ...COUNTRY_NAME,
  PL: 'Pancitolandia',
}

export function deckAvailable(deck: FreeDeck): boolean {
  if (deck === 'PL') return '../content/pl/cards.json' in MODULES
  return countryAvailable(deck)
}

export function useDeck(deck: FreeDeck): CardCatalog[] | null {
  const [cards, setCards] = useState<CardCatalog[] | null>(null)

  useEffect(() => {
    let active = true
    setCards(null)

    const promise =
      deck === 'PL'
        ? loadFile<CardCatalog[]>('pl', 'cards')
        : loadContent(deck).then((pack) => pack.cards)

    promise
      .then((loaded) => {
        if (active) setCards(loaded)
      })
      .catch(() => {
        if (active) setCards([])
      })

    return () => {
      active = false
    }
  }, [deck])

  return cards
}

export function useBacks(): Record<string, string> {
  const [backs, setBacks] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    const loader = MODULES['../content/backs.json']
    if (!loader) return

    loader()
      .then((module) => {
        if (active) setBacks(module.default as Record<string, string>)
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  return backs
}

const Context = createContext<CountryContent | null>(null)

export function useContent(): CountryContent {
  const content = useContext(Context)
  if (!content) {
    throw new Error('useContent must be used within ContentProvider')
  }
  return content
}

interface Props {
  country: CountryCode
  loading: ReactNode
  children: ReactNode
}

export function ContentProvider({ country, loading, children }: Props) {
  const [content, setContent] = useState<CountryContent | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setContent(null)
    setError(null)

    loadContent(country)
      .then((loaded) => {
        if (active) setContent(loaded)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })

    return () => {
      active = false
    }
  }, [country])

  if (error) return <MissingContent message={error} />
  if (!content) return <>{loading}</>
  return <Context.Provider value={content}>{children}</Context.Provider>
}

function MissingContent({ message }: { message: string }) {
  return (
    <div className="screen-error">
      <h1>Content missing</h1>
      <p>{message}</p>
      <pre>npm run content</pre>
    </div>
  )
}
