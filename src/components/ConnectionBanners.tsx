import { applyUpdate, useOnline, useUpdateAvailable } from '../lib/offline'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

/** Slim notices at the bottom: offline mode, and a new version ready to load. */
export function ConnectionBanners() {
  const t = useT()
  const online = useOnline()
  const update = useUpdateAvailable()

  if (update) {
    return (
      <div className="app-banner app-banner-update" role="status">
        <span>{t('updateReady')}</span>
        <button
          type="button"
          className="app-banner-action"
          onClick={() => {
            playSound('button')
            applyUpdate()
          }}
        >
          {t('updateNow')}
        </button>
      </div>
    )
  }

  if (!online) {
    return (
      <div className="app-banner app-banner-offline" role="status">
        <span className="app-banner-dot" aria-hidden="true" />
        <span>{t('offlineNotice')}</span>
      </div>
    )
  }

  return null
}
