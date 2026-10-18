import {
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { PancitoPointer, PancitoTip } from '../components/PancitoGuide'
import { Stars } from '../components/Stars'
import { useContent } from '../data/content'
import {
  isUnlocked,
  nextMissionId,
  starsFor,
  sectionsFrom,
  unlockedStories,
  sectionPerfect,
  sectionStats,
  campaignPerfect,
  isSectionUnlocked,
} from '../data/progression'
import { progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT, type TextKey } from '../lib/i18n'
import type { CountryCode, Level } from '../types'

function sectionKey(cards: number): TextKey {
  return `section${cards}` as TextKey
}

const ATLAS_MAP: Record<CountryCode, string> = {
  VE: '/imagenes/atlas/ve.webp',
  ES: '/imagenes/atlas/es.webp',
  EU: '/imagenes/atlas/eu.webp',
}

type MarkerXY = [number, number]

/**
 * Marker positions as % of the illustrated map (16:9). Each level sits on one
 * of the places painted on the map, in an order that zigzags across it so the
 * journey reads left to right when the map is panned on a phone.
 */
const ATLAS_ROUTES: Record<
  CountryCode,
  { normal: MarkerXY[]; hard: MarkerXY[] }
> = {
  VE: {
    normal: [
      [16, 50], // 1 Andean village under Pico Bolívar
      [15, 26], // 2 stilt houses on Lake Maracaibo
      [30, 22], // 3 Coro and its dunes
      [40, 50], // 4 cattle ranch in Los Llanos
      [51, 33], // 5 colonial Caracas under El Ávila
    ],
    hard: [
      [60, 48], // 6 Ciudad Bolívar and the Angostura bridge
      [70, 31], // 7 Margarita: Santa Rosa castle
      [85, 52], // 8 Warao stilt houses in the Orinoco delta
      [79, 81], // 9 Pemón village in La Gran Sabana
      [57, 80], // 10 Angel Falls
    ],
  },
  ES: {
    normal: [
      [20, 22], // 1 Santiago de Compostela
      [34, 20], // 2 Asturian village with hórreos
      [52, 26], // 3 Segovia aqueduct and alcázar
      [74, 23], // 4 Pyrenean stone village
      [88, 33], // 5 Barcelona: Sagrada Familia
    ],
    hard: [
      [75, 70], // 6 Valencia: barracas by the Albufera
      [61, 58], // 7 La Mancha windmills
      [50, 52], // 8 Madrid: Royal Palace and Puerta de Alcalá
      [52, 80], // 9 Granada: the Alhambra
      [29, 77], // 10 Seville: the Giralda
    ],
  },
  EU: {
    normal: [
      [13, 34], // 1 California mission among redwoods
      [35, 22], // 2 Yellowstone cabin and geyser
      [29, 48], // 3 Grand Canyon lookout
      [33, 60], // 4 New Mexico adobe pueblo
      [46, 72], // 5 Texas frontier town
    ],
    hard: [
      [66, 72], // 6 New Orleans and the steamboat
      [60, 49], // 7 Great Plains farm
      [50, 27], // 8 Mount Rushmore
      [81, 45], // 9 Washington: the Capitol
      [89, 33], // 10 New York: Statue of Liberty
    ],
  },
}

interface RouteSegment {
  key: string
  from: MarkerXY
  to: MarkerXY
  tone: 'normal' | 'hard'
}

/**
 * The route grows with the player: a segment joins a level to the next one
 * only once that next level is unlocked. Order follows the level numbers, so
 * the last normal level links on to the first hard one.
 */
function unlockedSegments(
  normal: Level[],
  hard: Level[],
  routes: { normal: MarkerXY[]; hard: MarkerXY[] },
  all: Level[],
  progress: ReturnType<typeof progressFor>,
): RouteSegment[] {
  const placed = [
    ...normal.map((level, i) => ({ level, at: routes.normal[i] ?? routes.normal[routes.normal.length - 1] })),
    ...hard.map((level, i) => ({ level, at: routes.hard[i] ?? routes.hard[routes.hard.length - 1] })),
  ].sort((a, b) => a.level.numero - b.level.numero)

  const segments: RouteSegment[] = []
  for (let i = 1; i < placed.length; i += 1) {
    const { level, at } = placed[i]!
    if (!isUnlocked(level, all, progress)) continue
    segments.push({
      key: level.id,
      from: placed[i - 1]!.at,
      to: at,
      tone: level.dificil ? 'hard' : 'normal',
    })
  }
  return segments
}

export function Levels() {
  const t = useT()
  const params = useParams<{ cards: string }>()
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

  const nextMission = useMemo(() => nextMissionId(levels, progress), [levels, progress])

  const active = Number(params.cards)
  const sectionIndex = sections.findIndex((s) => s.cards === active)
  const section = sectionIndex >= 0 ? sections[sectionIndex] : undefined
  const sectionOpen =
    sectionIndex >= 0 && isSectionUnlocked(sectionIndex, sections, progress)
  const routes = ATLAS_ROUTES[country]
  const allStarsDone = campaignPerfect(levels, progress)
  const segments = useMemo(
    () =>
      section ? unlockedSegments(section.normal, section.hard, routes, levels, progress) : [],
    [section, routes, levels, progress],
  )

  const stats = useMemo(
    () => (section ? sectionStats(section, progress) : null),
    [section, progress],
  )
  const starsLeft = stats ? stats.starsTotal - stats.stars : 0
  const missionsLeft = stats ? stats.missionsTotal - stats.missionsDone : 0

  const storiesOpen = useMemo(
    () => unlockedStories(stories, levels, progress).size,
    [stories, levels, progress],
  )
  const storiesTotal = stories.length
  const storiesLeft = Math.max(0, storiesTotal - storiesOpen)

  // On a phone the map is wider than the screen: start on the next mission.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const next = node.querySelector<HTMLElement>('.atlas-marker-wrap[data-next]')
    const center = next ? next.offsetLeft : node.scrollWidth / 2
    node.scrollLeft = Math.max(0, center - node.clientWidth / 2)
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

  if (!section || !stats || !sectionOpen) return <Navigate to="/levels" replace />

  return (
    <main id="main-content" className="screen screen-levels" tabIndex={-1}>
      <Header title={t(sectionKey(section.cards))} backTo="/levels" />

      <PancitoTip
        tipId="levels-atlas"
        textKey="tipLevelsAtlas"
        pose="guide"
        className="pancito-tip-levels"
      />

      <div className="atlas-summary">
        <div className="atlas-summary-main">
          <p className="atlas-rank">
            {t(sectionKey(section.cards))}
            {sectionPerfect(section, progress) && (
              <span className="summary-trophy" title={t('sectionTrophy')} aria-label={t('sectionTrophy')}>
                ♛
              </span>
            )}
            {allStarsDone && (
              <span className="summary-trophy summary-trophy-master" title={t('campaignTrophy')} aria-label={t('campaignTrophy')}>
                ★
              </span>
            )}
          </p>
          <p className="atlas-meta">{t('cardsCount', { n: section.cards })}</p>
        </div>
        <dl className="atlas-summary-stats">
          <div>
            <dt>{t('missions')}</dt>
            <dd>
              {t('atlasCount', { a: stats.missionsDone, b: stats.missionsTotal })}
              <span className="atlas-summary-left">
                {t('atlasRemaining', { n: missionsLeft })}
              </span>
            </dd>
          </div>
          <div>
            <dt>{t('stars')}</dt>
            <dd>
              {t('atlasCount', { a: stats.stars, b: stats.starsTotal })}
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
            {segments.map((segment, index) => {
              const latest = index === segments.length - 1
              const ends = {
                x1: segment.from[0],
                y1: segment.from[1],
                x2: segment.to[0],
                y2: segment.to[1],
              }
              return (
                <g key={segment.key} data-latest={latest || undefined}>
                  {/* Paper-colored halo so the dashes read on any part of the map. */}
                  <line className="atlas-path-halo" {...ends} />
                  <line className={`atlas-path atlas-path-${segment.tone}`} {...ends} />
                </g>
              )
            })}
          </svg>

          <AtlasRoute
            tone="normal"
            levels={section.normal}
            positions={routes.normal}
            all={levels}
            nextMissionId={nextMission}
          />
          <AtlasRoute
            tone="hard"
            levels={section.hard}
            positions={routes.hard}
            all={levels}
            nextMissionId={nextMission}
          />
        </section>
      </div>
    </main>
  )
}

interface AtlasRouteProps {
  tone: 'normal' | 'hard'
  levels: Level[]
  positions: MarkerXY[]
  all: Level[]
  nextMissionId: string | null
}

function AtlasRoute({
  tone,
  levels,
  positions,
  all,
  nextMissionId,
}: AtlasRouteProps) {
  const navigate = useNavigate()
  const t = useT()
  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))

  return (
    <div className="atlas-route" data-tone={tone}>
      {levels.map((level, index) => {
        const open = isUnlocked(level, all, progress)
        const stars = starsFor(progress, level.id)
        const isNext = level.id === nextMissionId
        const [x, y] = positions[index] ?? positions[positions.length - 1]
        const style = { left: `${x}%`, top: `${y}%` } as CSSProperties

        return (
          <div
            key={level.id}
            className="atlas-marker-wrap"
            style={style}
            data-next={isNext || undefined}
          >
            <button
              type="button"
              className="atlas-marker"
              data-open={open}
              data-stars={stars}
              data-next={isNext || undefined}
              disabled={!open}
              title={
                open
                  ? `${t('level')} ${level.numero}`
                  : t('completePrevious')
              }
              aria-label={
                open
                  ? `${t('level')} ${level.numero}. ${t('starsOf', { a: stars, b: 3 })}${
                      isNext ? `. ${t('nextMission')}` : ''
                    }`
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
            {isNext && <PancitoPointer />}
          </div>
        )
      })}
    </div>
  )
}
