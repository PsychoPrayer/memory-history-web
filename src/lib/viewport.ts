/** Layout refit for mobile browsers (Safari bar, keyboard, rotation). */
export const REFIT_EVENT = 'mh:refit'

function readViewportHeight(): number {
  return Math.round(window.visualViewport?.height ?? window.innerHeight)
}

/** Sync CSS viewport height and notify layout listeners (board, etc.). */
export function refitLayout(options?: { scrollTop?: boolean }) {
  const height = readViewportHeight()
  document.documentElement.style.setProperty('--app-height', `${height}px`)
  window.dispatchEvent(new CustomEvent(REFIT_EVENT))

  if (options?.scrollTop) {
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.scrollTo?.(0, 0)
  }
}

export function initViewportRefit() {
  refitLayout()

  const onResize = () => refitLayout()
  const onOrientation = () => refitLayout({ scrollTop: true })

  window.addEventListener('orientationchange', onOrientation)
  window.addEventListener('resize', onResize)
  window.visualViewport?.addEventListener('resize', onResize)

  return () => {
    window.removeEventListener('orientationchange', onOrientation)
    window.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('resize', onResize)
  }
}
