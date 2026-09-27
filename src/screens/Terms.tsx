import { Header } from '../components/Header'
import { termsText } from '../content/legal/terms'
import { useLanguage, useT } from '../lib/i18n'

/** Read-only terms and privacy policy; also a stable public URL for app stores. */
export function Terms() {
  const t = useT()
  const language = useLanguage()
  return (
    <main id="main-content" className="screen screen-terms" tabIndex={-1}>
      <Header title={t('termsTitle')} backTo="/settings" />
      <div className="terms-body terms-page">{termsText(language)}</div>
    </main>
  )
}
