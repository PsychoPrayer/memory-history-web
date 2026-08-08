import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Stars } from '../components/Stars'
import { useContent } from '../data/content'
import {
  isUnlocked,
  starsFor,
  sectionsFrom,
  unlockedStories,
} from '../data/progression'
import { progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT, type TextKey } from '../lib/i18n'
import type { CountryCode, Level } from '../types'

function sectionKey(cards: number): TextKey {
  return `section${cards}` as TextKey
}

const ATLAS_MAP: Record<CountryCode, string> = {
  VE: '/imagenes/atlas/ve.png',
  ES: '/imagenes/atlas/es.png',
  EU: '/imagenes/atlas/eu.png',
}

type MarkerXY = [number, number]

/** Land-biased routes per country (percent of the plate). */
const ATLAS_ROUTES: Record<
  CountryCode,
  { normal: MarkerXY[]; hard: MarkerXY[] }
> = {
  VE: {
    normal: [
      [18, 34],
      [32, 30],
      [46, 28],
      [60, 32],
      [74, 30],
    ],
    hard: [
      [22, 58],
      [36, 62],
      [50, 56],
      [64, 64],
      [78, 58],
    ],
  },
  ES: {
    normal: [
      [22, 30],
      [36, 28],
      [48, 32],
      [62, 30],
      [74, 34],
    ],
    hard: [
      [26, 58],
      [40, 62],
      [52, 56],
      [66, 60],
      [78, 64],
    ],
  },
  EU: {
    normal: [
      [16, 36],
      [30, 32],
      [46, 30],
      [62, 34],
      [78, 32],
    ],
    hard: [
      [20, 60],
      [36, 64],
      [52, 58],
      [68, 62],
      [84, 56],
    ],
  },
}

function pathD(points: MarkerXY[]): string {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
}

export function Levels() {
  const t = useT()
  const { levels, stories } = useContent()
  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ active: boolean; x: number; left: number }>({
    active: false,
    x: 0,
    left: 0,
  })

  const sections = useMemo(() => sectionsFrom(levels), [levels])

  const initial = useMemo(() => {
    const pending = sections.find((section) =>
      [...section.normal, ...section.hard].some(
        (level) => starsFor(progress, level.id) === 0,
      ),
    )
    return pending?.cards ?? sections[0]?.cards ?? 12
  }, [sections, progress])

  const [active, setActive] = useState(initial)
  const section = sections.find((s) => s.cards === active) ?? sections[0]
  const routes = ATLAS_ROUTES[country]

  const sectionLevels = useMemo(
    () => (section ? [...section.normal, ...section.hard] : []),
    [section],
  )

  const starsEarned = useMemo(
    () => sectionLevels.reduce((sum, level) => sum + starsFor(progress, level.id), 0),
    [sectionLevels, progress],
  )
  const starsTotal = sectionLevels.length * 3
  const starsLeft = Math.max(0, starsTotal - starsEarned)

  const storiesOpen = useMemo(
    () => unlockedStories(stories, levels, progress).size,
    [stories, levels, progress],
  )
  const storiesTotal = stories.length
  const storiesLeft = Math.max(0, storiesTotal - storiesOpen)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollLeft = Math.max(0, (node.scrollWidth - node.clientWidth) / 2)
  }, [country, active])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current
    if (!node) return
    drag.current = {
      active: true,
      x: event.clientX,
      left: node.scrollLeft,
    }
    node.setPointerCapture(event.pointerId)
    node.dataset.dragging = 'true'
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current
    if (!node || !drag.current.active) return
    node.scrollLeft = drag.current.left - (event.clientX - drag.current.x)
  }

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const node = scrollRef.current
    drag.current.active = false
    if (node) {
      node.dataset.dragging = 'false'
      try {
        node.releasePointerCapture(event.pointerId)
      } catch {
        /* already released */
      }
    }
  }

  if (!section) return null

  return (
    <main id="main-content" className="screen screen-levels" tabIndex={-1}>
      <Header title={t('levels')} />

      <nav className="section-tabs" aria-label={t('levels')}>
        {sections.map((other) => (
          <button
            key={other.cards}
            type="button"
            className="tab"
            data-active={other.cards === active}
            onClick={() => {
              playSound('transition')
              setActive(other.cards)
            }}
          >
            {t(sectionKey(other.cards))}
          </button>
        ))}
      </nav>

      <div className="atlas-summary">
        <div className="atlas-summary-main">
          <p className="atlas-rank">{t(sectionKey(section.cards))}</p>
          <p className="atlas-meta">{t('cardsCount', { n: section.cards })}</p>
        </div>
        <dl className="atlas-summary-stats">
          <div>
            <dt>{t('stars')}</dt>
            <dd>
              {t('atlasCount', { a: starsEarned, b: starsTotal })}
              <span className="atlas-summary-left">
                {t('atlasRemaining', { n: starsLeft })}
              </span>
            </dd>
          </div>
          <div>
            <dt>{t('stories')}</dt>
            <dd>
              {t('atlasCount', { a: storiesOpen, b: storiesTotal })}
              <span className="atlas-summary-left">
                {t('atlasRemaining', { n: storiesLeft })}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div
        ref={scrollRef}
        className="atlas-scroll"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <section
          className="atlas-plate"
          data-country={country.toLowerCase()}
          aria-label={t('sectionLabel', {
            name: t(sectionKey(section.cards)),
            n: section.cards,
          })}
        >
          <img
            className="atlas-map"
            src={ATLAS_MAP[country]}
            alt=""
            draggable={false}
          />
          <div className="atlas-veil" aria-hidden="true" />

          <svg
            className="atlas-paths"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path className="atlas-path atlas-path-normal" d={pathD(routes.normal)} />
            <path className="atlas-path atlas-path-hard" d={pathD(routes.hard)} />
          </svg>

          <AtlasRoute
            label={t('normal')}
            tone="normal"
            levels={section.normal}
            positions={routes.normal}
            all={levels}
          />
          <AtlasRoute
            label={t('hard')}
            tone="hard"
            levels={section.hard}
            positions={routes.hard}
            all={levels}
          />
        </section>
      </div>
    </main>
  )
}

interface AtlasRouteProps {
  label: string
  tone: 'normal' | 'hard'
  levels: Level[]
  positions: MarkerXY[]
  all: Level[]
}

function AtlasRoute({ label, tone, levels, positions, all }: AtlasRouteProps) {
  const navigate = useNavigate()
  const t = useT()
  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))

  return (
    <div className="atlas-route" data-tone={tone}>
      {levels.map((level, index) => {
        const open = isUnlocked(level, all, progress)
        const stars = starsFor(progress, level.id)
        const [x, y] = positions[index] ?? positions[positions.length - 1]
        const style = { left: `${x}%`, top: `${y}%` } as CSSProperties

        return (
          <div key={level.id} className="atlas-marker-wrap" style={style}>
            {index === 0 && (
              <span className="atlas-route-tag" aria-hidden="true">
                {label}
              </span>
            )}
            <button
              type="button"
              className="atlas-marker"
              data-open={open}
              data-stars={stars}
              disabled={!open}
              title={open ? level.nombre : t('completePrevious')}
              aria-label={
                open
                  ? `${t('level')} ${level.numero}. ${t('starsOf', { a: stars, b: 3 })}`
                  : `${t('level')} ${level.numero}. ${t('locked')}`
              }
              onClick={() => {
                playSound('transition')
                navigate(`/game/${encodeURIComponent(level.id)}`)
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <span className="atlas-marker-face">
                <span className="atlas-marker-number">{level.numero}</span>
                {open ? (
                  <Stars count={stars} size="pip" />
                ) : (
                  <span className="tile-lock" aria-hidden="true" />
                )}
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
