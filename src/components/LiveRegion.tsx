import { useEffect, useState } from 'react'
import { subscribeAnnouncements } from '../lib/a11y'

/** Invisible live region for screen-reader status updates. */
export function LiveRegion() {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  useEffect(() => {
    return subscribeAnnouncements((message, mode) => {
      if (mode === 'assertive') {
        setAssertive('')
        requestAnimationFrame(() => setAssertive(message))
      } else {
        setPolite('')
        requestAnimationFrame(() => setPolite(message))
      }
    })
  }, [])

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </>
  )
}
