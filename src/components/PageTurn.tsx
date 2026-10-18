import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Routes, useLocation, type Location } from 'react-router-dom'
import { playSound } from '../lib/audio'

const TURN_MS = 720

type Direction = 'forward' | 'back'

/** How deep a screen sits in the book: going deeper turns forward, coming out turns back. */
function depth(pathname: string): number {
  if (pathname === '/') return 0
  if (pathname === '/menu') return 1
  if (pathname.startsWith('/game/')) return 4
  if (/^\/(levels|quiz)\/[^/]+$/.test(pathname) || pathname === '/free/match' || pathname === '/terms') return 3
  return 2
}

const isMatch = (pathname: string) => pathname.startsWith('/game/') || pathname === '/free/match'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * A frozen, non-interactive copy of what the screen shows right now, laid out
 * exactly where it is (same scroll), so it can be turned like a sheet of paper.
 */
function snapshot(page: HTMLElement, className: string): HTMLDivElement {
  const sheet = document.createElement('div')
  sheet.className = className
  sheet.setAttribute('aria-hidden', 'true')
  sheet.inert = true

  // Only the page turns: the table stays where it is, so the face is see-through
  // and the sheet hinges on the page's own left edge.
  const face = document.createElement('div')
  face.className = 'page-turn-face'
  // The page left behind must hide the new one until the returning sheet covers it.
  if (className === 'page-turn-under') face.style.background = 'var(--mesa)'
  const sheetLeft = page.firstElementChild?.getBoundingClientRect().left ?? 0
  sheet.style.transformOrigin = `${Math.max(0, sheetLeft)}px 50%`

  const copy = document.createElement('div')
  copy.className = 'page-turn-copy'
  copy.style.top = `${-window.scrollY}px`
  copy.style.left = `${-window.scrollX}px`
  // Same box as #root, so screens sized with 100% lay out identically.
  const root = document.getElementById('root')
  copy.style.width = `${root?.clientWidth ?? window.innerWidth}px`
  copy.style.height = `${root?.clientHeight ?? window.innerHeight}px`

  for (const child of Array.from(page.children)) {
    const clone = child.cloneNode(true) as HTMLElement
    copy.appendChild(clone)
    copyScroll(child, clone)
  }
  for (const element of Array.from(copy.querySelectorAll('[id]'))) element.removeAttribute('id')

  face.appendChild(copy)
  sheet.appendChild(face)
  return sheet
}

/** Inner scroll positions are not part of a clone; copy them over. */
function copyScroll(source: Element, clone: Element) {
  const scrolled: Array<[number, number, number]> = []
  const from = [source, ...Array.from(source.querySelectorAll('*'))]
  from.forEach((element, index) => {
    if (element.scrollTop || element.scrollLeft) scrolled.push([index, element.scrollTop, element.scrollLeft])
  })
  if (!scrolled.length) return
  const to = [clone, ...Array.from(clone.querySelectorAll('*'))]
  requestAnimationFrame(() => {
    for (const [index, top, left] of scrolled) {
      to[index]?.scrollTo(left, top)
    }
  })
}

/**
 * Routes that change like the pages of a book. Going deeper, the current page
 * lifts from its right edge and turns away to the left; going back, the
 * previous page comes back over it from the left. The screens themselves are
 * untouched: the turning sheet is a snapshot laid over them.
 */
export function PageTurnRoutes({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [shown, setShown] = useState<Location>(location)
  const pageRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)
  const pendingBack = useRef<HTMLDivElement | null>(null)
  const timer = useRef(0)

  const clear = () => {
    window.clearTimeout(timer.current)
    layerRef.current?.remove()
    layerRef.current = null
    pendingBack.current = null
  }

  const layer = () => {
    const element = document.createElement('div')
    element.className = 'page-turn'
    element.style.setProperty('--page-turn-ms', `${TURN_MS}ms`)
    element.style.perspective = `${Math.max(1600, window.innerWidth * 2.4)}px`
    document.body.appendChild(element)
    layerRef.current = element
    timer.current = window.setTimeout(clear, TURN_MS + 80)
    return element
  }

  // Old screen is still on the page: copy it before the new one replaces it.
  useLayoutEffect(() => {
    if (location.key === shown.key) return
    const from = shown.pathname
    const to = location.pathname
    const page = pageRef.current
    // From one match to the next the cards just change on the same table.
    const animate =
      page && from !== '/' && from !== to && !(isMatch(from) && isMatch(to)) && !prefersReducedMotion()

    clear()
    if (animate) {
      const direction: Direction = depth(to) < depth(from) ? 'back' : 'forward'
      const element = layer()
      element.classList.add(`page-turn-${direction}`)
      if (direction === 'forward') {
        element.append(
          Object.assign(document.createElement('div'), { className: 'page-turn-shadow' }),
          snapshot(page, 'page-turn-leaf'),
        )
      } else {
        // The page being left stays still underneath; the previous page is
        // copied once it has rendered (next effect) and swings back over it.
        element.append(snapshot(page, 'page-turn-under'))
        pendingBack.current = element
      }
      playSound('page')
    }
    setShown(location)
  }, [location, shown])

  // New screen has rendered: for a back turn, it becomes the returning sheet.
  useLayoutEffect(() => {
    const element = pendingBack.current
    const page = pageRef.current
    if (!element || !page) return
    pendingBack.current = null
    element.append(
      Object.assign(document.createElement('div'), { className: 'page-turn-shadow' }),
      snapshot(page, 'page-turn-leaf'),
    )
  }, [shown])

  useLayoutEffect(() => clear, [])

  return (
    <div ref={pageRef} className="page-turn-page">
      <Routes location={shown}>{children}</Routes>
    </div>
  )
}
