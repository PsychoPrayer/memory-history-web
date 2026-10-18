import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
} from 'react'
import { useLocation } from 'react-router-dom'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import { useSave } from '../lib/save'

/** Opening timeline in ms after the tap, passed to the CSS animations. */
const CLASP_AT = 600
const OPEN_AT = 1150
const SETTLE_AT = 2950
const DONE_AT = 3750
/** Idle time before the hint asks the player to tap the book. */
const HINT_AFTER_MS = 4000
/** Never wait longer than this for the painted pieces. */
const IMAGES_WAIT_MS = 2500

/** Sparks from the buckle and dust from the gutter: fixed so every launch looks the same. */
const SPARKS = Array.from({ length: 16 }, (_, index) => {
  const angle = (index / 16) * Math.PI * 2 + 0.3
  const reach = 56 + (index % 3) * 22
  return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, delay: (index % 4) * 25 }
})
const DUST = Array.from({ length: 16 }, (_, index) => ({
  x: 4 + ((index * 37) % 46),
  y: 30 + ((index * 53) % 60),
  drift: ((index * 29) % 40) - 10,
  delay: 100 + ((index * 83) % 900),
  size: 3 + (index % 3) * 2,
}))

/** Painted pieces of the book (docs/arte/prompts-libro-de-exploracion.md). */
const BOOK_IMAGES = [
  '/imagenes/libro/mesa.webp',
  '/imagenes/libro/tapa.webp',
  '/imagenes/libro/tapa-interior.webp',
  '/imagenes/libro/pagina.webp',
  '/imagenes/libro/canto.webp',
  '/imagenes/intro/memory-history.webp',
  '/imagenes/ui/pancito/happy.webp',
  '/imagenes/ui/pancito/guide.webp',
]

let imagesReady: Promise<void> | null = null

/** Called during the intro logos so the book is ready when it appears. */
export function preloadBookImages(): Promise<void> {
  imagesReady ??= Promise.all(
    BOOK_IMAGES.map((src) => {
      const image = new Image()
      image.src = src
      return image.decode().catch(() => undefined)
    }),
  ).then(() => undefined)
  return imagesReady
}

let played = false

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

type Phase = 'loading' | 'closed' | 'opening'

/**
 * Right after the intro logos, Pancito's exploration book lies closed on the
 * table and waits for a tap. Then its brass clasp snaps, the cover swings
 * away and the first page grows into the menu page lying on the same table,
 * so the player never leaves the book. Shown once per launch.
 */
export function BookOpening() {
  const location = useLocation()
  const requested = (location.state as { openBook?: boolean } | null)?.openBook === true
  const [active, setActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [hint, setHint] = useState(false)
  const [target, setTarget] = useState<CSSProperties>({})
  const sceneRef = useRef<HTMLDivElement>(null)
  const t = useT()
  const playerName = useSave((state) => state.settings.playerName.trim())

  // Before paint, so the menu never flashes ahead of the closed book.
  useLayoutEffect(() => {
    if (requested && !played && !prefersReducedMotion()) {
      played = true
      setActive(true)
    }
  }, [requested])

  // The book holds still until the painted pieces are decoded.
  useEffect(() => {
    if (!active || phase !== 'loading') return
    let cancelled = false
    const show = () => {
      if (!cancelled) setPhase('closed')
    }
    void preloadBookImages().then(show)
    const id = window.setTimeout(show, IMAGES_WAIT_MS)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [active, phase])

  useEffect(() => {
    if (phase !== 'closed') return
    const id = window.setTimeout(() => setHint(true), HINT_AFTER_MS)
    return () => clearTimeout(id)
  }, [phase])

  // Safety net in case the last animation end event never arrives.
  useEffect(() => {
    if (phase !== 'opening') return
    const id = window.setTimeout(() => setActive(false), DONE_AT + 1500)
    return () => clearTimeout(id)
  }, [phase])

  const open = () => {
    if (phase !== 'closed') return
    setTarget(menuPageTarget(sceneRef.current))
    setPhase('opening')
  }

  useEffect(() => {
    if (phase !== 'closed') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') open()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onAnimationStart = (event: AnimationEvent) => {
    if (event.animationName === 'bo-pin') playSound('clasp')
    if (event.animationName === 'bo-open') playSound('page')
  }

  const onAnimationEnd = (event: AnimationEvent) => {
    if (event.target === event.currentTarget && event.animationName === 'bo-fade') setActive(false)
  }

  if (!active) return null

  return (
    <div
      className={`book-opening bo-${phase}`}
      onAnimationStart={onAnimationStart}
      onAnimationEnd={onAnimationEnd}
      style={
        {
          '--bo-clasp': `${CLASP_AT}ms`,
          '--bo-open': `${OPEN_AT}ms`,
          '--bo-settle': `${SETTLE_AT}ms`,
          '--bo-settle-ms': `${DONE_AT - SETTLE_AT}ms`,
          ...target,
        } as CSSProperties
      }
    >
      <div className="bo-scene" ref={sceneRef}>
        <div
          className="bo-book"
          role="button"
          tabIndex={0}
          aria-label={t('bookOpenHint')}
          onClick={open}
        >
          <div className="bo-block">
            <div className="bo-page">
              <p className="bo-kicker">{t('bookDiaryOf')}</p>
              <p className="bo-name">{playerName || 'Pancito'}</p>
              <p className="bo-ornament" aria-hidden="true">❖</p>
              <img className="bo-guide" src="/imagenes/ui/pancito/guide.webp" alt="" draggable={false} />
            </div>
          </div>

          <div className="bo-glow" />
          {DUST.map((mote, index) => (
            <span
              key={index}
              className="bo-dust"
              style={
                {
                  left: `${mote.x}%`,
                  top: `${mote.y}%`,
                  width: mote.size,
                  height: mote.size,
                  '--drift': `${mote.drift}px`,
                  animationDelay: `calc(var(--bo-open) + ${mote.delay}ms)`,
                } as CSSProperties
              }
            />
          ))}

          <div className="bo-cover">
            <div className="bo-face bo-front">
              <img className="bo-logo" src="/imagenes/intro/memory-history.webp" alt="Memory History" draggable={false} />
              <span className="bo-medal">
                <img src="/imagenes/ui/pancito/happy.webp" alt="" draggable={false} />
              </span>
              <span className="bo-title">{t('bookTitle')}</span>
            </div>
            <div className="bo-face bo-back" />
          </div>

          <div className="bo-strap">
            <span className="bo-buckle">
              <span className="bo-pin" />
            </span>
          </div>
          <div className="bo-sparks">
            <span className="bo-flash" />
            {SPARKS.map((spark, index) => (
              <span
                key={index}
                className="bo-spark"
                style={
                  {
                    '--sx': `${spark.x}px`,
                    '--sy': `${spark.y}px`,
                    animationDelay: `calc(var(--bo-clasp) + ${spark.delay}ms)`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </div>
      <p className={`bo-hint${hint ? ' bo-hint-visible' : ''}`} aria-live="polite">
        {hint ? t('bookOpenHint') : ''}
      </p>
    </div>
  )
}

/**
 * Where the book page must end up to land exactly on the menu page that is
 * already rendered underneath, as a translate + scale for the scene.
 */
function menuPageTarget(scene: HTMLElement | null): CSSProperties {
  const page = document.querySelector('.screen-menu')
  if (!scene || !page) return {}
  const from = scene.getBoundingClientRect()
  const to = page.getBoundingClientRect()
  if (!from.width || !from.height || !to.width || !to.height) return {}
  return {
    '--bo-dx': `${to.left + to.width / 2 - (from.left + from.width / 2)}px`,
    '--bo-dy': `${to.top + to.height / 2 - (from.top + from.height / 2)}px`,
    '--bo-sx': `${to.width / from.width}`,
    '--bo-sy': `${to.height / from.height}`,
  } as CSSProperties
}
