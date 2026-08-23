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

  if (options?.scrollTop !== false) {
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.scrollTo?.(0, 0)
  }
}

export function initViewportRefit() {
  refitLayout({ scrollTop: false })

  const onChange = () => refitLayout()
  window.addEventListener('orientationchange', onChange)
  window.addEventListener('resize', onChange)
  window.visualViewport?.addEventListener('resize', onChange)
  window.visualViewport?.addEventListener('scroll', onChange)

  return () => {
    window.removeEventListener('orientationchange', onChange)
    window.removeEventListener('resize', onChange)
    window.visualViewport?.removeEventListener('resize', onChange)
    window.visualViewport?.removeEventListener('scroll', onChange)
  }
}
