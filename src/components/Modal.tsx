import { useEffect, useId, useRef, type ReactNode } from 'react'
import { focusableElements } from '../lib/a11y'

interface Props {
  open: boolean
  onClose?: () => void
  width?: 'normal' | 'wide'
  titleId?: string
  children: ReactNode
}

export function Modal({ open, onClose, width = 'normal', titleId, children }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const fallbackTitleId = useId()
  const labelledBy = titleId ?? fallbackTitleId

  useEffect(() => {
    if (!open) return

    previousFocus.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    if (!dialog) return

    const title = dialog.querySelector<HTMLElement>('.modal-title')
    if (title && !title.id) title.id = labelledBy

    const focusFirst = () => {
      const items = focusableElements(dialog)
      ;(items[0] ?? dialog).focus()
    }
    const id = window.requestAnimationFrame(focusFirst)

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onClose) {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusableElements(dialog)
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(id)
      window.removeEventListener('keydown', onKey)
      previousFocus.current?.focus?.()
    }
  }, [open, onClose, labelledBy, children])

  if (!open) return null

  return (
    <div className="overlay" onClick={onClose ? () => onClose() : undefined}>
      <div
        ref={dialogRef}
        className="modal"
        data-width={width}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
