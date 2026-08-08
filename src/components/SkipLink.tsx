import { useT } from '../lib/i18n'

/** First focusable control: jumps past chrome into the page main. */
export function SkipLink() {
  const t = useT()
  return (
    <a className="skip-link" href="#main-content">
      {t('skipToContent')}
    </a>
  )
}
