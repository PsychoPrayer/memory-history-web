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
import { PancitoPointer, PancitoTip } from '../components/PancitoGuide'
import { Stars } from '../components/Stars'
import { useContent } from '../data/content'
import {
  isUnlocked,
  isBeaten,
  starsFor,
  sectionsFrom,
  unlockedStories,
  sectionPerfect,
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
      [28, 28], // 1 Maracaibo (further west)
      [38, 30], // 2 east of Maracaibo
      [52, 28], // 3 Caracas coast
      [62, 28], // 4 Cumaná north-central
      [72, 30], // 5 Cumaná east / Orinoco delta
    ],
    hard: [
      [32, 46], // 6 Los Llanos west
      [48, 48], // 7 Los Llanos center
      [54, 62], // 8 south-central (lower)
      [64, 52], // 9 Guayana west
      [74, 56], // 10 Guayana east
    ],
  },
  /* Spain — placed from the marked atlas guide. */
  ES: {
    normal: [
      [33, 25], // 1 Galicia (Santiago)
      [43, 23], // 2 Asturias
      [50, 35], // 3 Castilla (north / Burgos)
      [60, 28], // 4 Aragón (near Pyrenees)
      [71, 30], // 5 Cataluña (coast)
    ],
    hard: [
      [37, 52], // 6 Extremadura
      [51, 52], // 7 south of Madrid (Vielle / New Castile)
      [47, 78], // 8 Andalucía (Sevilla–Córdoba)
      [64, 58], // 9 Murcia
      [79, 49], // 10 Islas Baleares (Mallorca)
    ],
  },
  /* Continental US: avoid Canada, Mexico, deep ocean */
  EU: {
    normal: [
      [20, 30], // Northwest
      [34, 28], // Northern plains
      [48, 30], // Upper Midwest
      [62, 32], // Great Lakes
      [76, 30], // Northeast
    ],
    hard: [
      [18, 50], // California
      [30, 56], // Southwest
      [44, 60], // Texas
      [58, 62], // Deep South
      [70, 58], // Southeast / Florida approach
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

  /** Next mission: first unlocked level not yet cleared, by campaign order. */
  const nextMissionId = useMemo(() => {
    const ordered = [...levels].sort((a, b) => a.numero - b.numero)
    const pending = ordered.find(
      (level) => isUnlocked(level, levels, progress) && !isBeaten(progress, level.id),
    )
    if (pending) return pending.id
    // All cleared: nudge the first that still lacks 3 stars.
    return (
      ordered.find(
        (level) =>
          isUnlocked(level, levels, progress) && starsFor(progress, level.id) < 3,
      )?.id ?? null
    )
  }, [levels, progress])

  const initial = useMemo(() => {
    const nextLevel = levels.find((level) => level.id === nextMissionId)
    if (nextLevel) return nextLevel.cartas
    const pending = sections.find((section) =>
      [...section.normal, ...section.hard].some(
        (level) => starsFor(progress, level.id) === 0,
      ),
    )
    return pending?.cards ?? sections[0]?.cards ?? 12
  }, [levels, nextMissionId, sections, progress])

  const [active, setActive] = useState(initial)

  useEffect(() => {
    const index = sections.findIndex((s) => s.cards === active)
    if (index >= 0 && !isSectionUnlocked(index, sections, progress)) {
      const open = sections.findIndex((_, i) => isSectionUnlocked(i, sections, progress))
      if (open >= 0) setActive(sections[open].cards)
    }
  }, [active, sections, progress])

  const section = sections.find((s) => s.cards === active) ?? sections[0]
  const routes = ATLAS_ROUTES[country]
  const allStarsDone = campaignPerfect(levels, progress)

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
        {sections.map((other, index) => {
          const open = isSectionUnlocked(index, sections, progress)
          const hasNext =
            open &&
            levels.some(
              (level) => level.id === nextMissionId && level.cartas === other.cards,
            )
          const perfect = open && sectionPerfect(other, progress)
          return (
            <button
              key={other.cards}
              type="button"
              className="tab"
              data-active={other.cards === active}
              data-next={hasNext || undefined}
              data-locked={!open || undefined}
              data-trophy={perfect || undefined}
              disabled={!open}
              title={open ? undefined : t('sectionLocked')}
              aria-label={
                open
                  ? `${t(sectionKey(other.cards))}${perfect ? `. ${t('sectionTrophy')}` : ''}`
                  : `${t(sectionKey(other.cards))}. ${t('sectionLocked')}`
              }
              onClick={() => {
                playSound('transition')
                setActive(other.cards)
              }}
            >
              {!open && <span className="tab-lock" aria-hidden="true" />}
              {perfect && <span className="tab-trophy" aria-hidden="true" />}
              {t(sectionKey(other.cards))}
            </button>
          )
        })}
      </nav>

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
            tone="normal"
            levels={section.normal}
            positions={routes.normal}
            all={levels}
            nextMissionId={nextMissionId}
          />
          <AtlasRoute
            tone="hard"
            levels={section.hard}
            positions={routes.hard}
            all={levels}
            nextMissionId={nextMissionId}
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
