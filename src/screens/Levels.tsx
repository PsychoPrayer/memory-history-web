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
  VE: '/imagenes/atlas/ve.png',
  ES: '/imagenes/atlas/es.png',
  EU: '/imagenes/atlas/eu.png',
}

type MarkerXY = [number, number]

/**
 * Marker positions as % of the map image (same aspect for all atlas plates).
 * Tuned so routes stay on the country landmass, not neighbors or ocean.
 */
const ATLAS_ROUTES: Record<
  CountryCode,
  { normal: MarkerXY[]; hard: MarkerXY[] }
> = {
  /* Venezuela — placed from the marked atlas guide. */
  VE: {
    normal: [
      [27.3, 26.9], // 1 Maracaibo (further west)
      [37.7, 28.9], // 2 east of Maracaibo
      [52.1, 26.9], // 3 Caracas coast
      [62.5, 26.9], // 4 Cumaná north-central
      [72.8, 28.9], // 5 Cumaná east / Orinoco delta
    ],
    hard: [
      [31.5, 45.3], // 6 Los Llanos west
      [48, 47.4], // 7 Los Llanos center
      [54.2, 61.7], // 8 south-central (lower)
      [64.5, 51.4], // 9 Guayana west
      [74.8, 55.5], // 10 Guayana east
    ],
  },
  /* Spain — placed from the marked atlas guide. */
  ES: {
    normal: [
      [32.5, 23.8], // 1 Galicia (Santiago)
      [42.8, 21.8], // 2 Asturias
      [50.1, 34.1], // 3 Castilla (north / Burgos)
      [60.4, 26.9], // 4 Aragón (near Pyrenees)
      [71.7, 28.9], // 5 Cataluña (coast)
    ],
    hard: [
      [36.6, 51.4], // 6 Extremadura
      [51.1, 51.4], // 7 south of Madrid (Vielle / New Castile)
      [47, 78], // 8 Andalucía (Sevilla–Córdoba)
      [64.5, 57.6], // 9 Murcia
      [80, 48.4], // 10 Islas Baleares (Mallorca)
    ],
  },
  /* Continental US: avoid Canada, Mexico, deep ocean */
  EU: {
    normal: [
      [19.1, 28.9], // Northwest
      [33.5, 26.9], // Northern plains
      [48, 28.9], // Upper Midwest
      [62.5, 31], // Great Lakes
      [76.9, 28.9], // Northeast
    ],
    hard: [
      [17, 49.4], // California
      [29.4, 55.5], // Southwest
      [43.9, 59.6], // Texas
      [58.3, 61.7], // Deep South
      [70.7, 57.6], // Southeast / Florida approach
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
            <path className="atlas-path atlas-path-normal" d={pathD(routes.normal)} />
            <path className="atlas-path atlas-path-hard" d={pathD(routes.hard)} />
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
