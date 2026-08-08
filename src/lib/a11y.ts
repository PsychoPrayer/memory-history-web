/**
 * Screen-reader announcements via a polite/assertive live region.
 */

type Listener = (message: string, mode: 'polite' | 'assertive') => void

const listeners = new Set<Listener>()

export function announce(
  message: string,
  mode: 'polite' | 'assertive' = 'polite',
) {
  if (!message.trim()) return
  for (const listener of listeners) listener(message, mode)
}

export function subscribeAnnouncements(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Focusable controls inside a container (for modal focus traps). */
export function focusableElements(root: HTMLElement): HTMLElement[] {
  const nodes = root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )
  return Array.from(nodes).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
  )
}
