import { useEffect, useState, type CSSProperties } from 'react'
import {
  downloadAllMedia,
  fetchMediaManifest,
  offlineReadyVersion,
  offlineSupported,
  useOnline,
  type DownloadProgress,
  type MediaManifest,
} from '../lib/offline'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

/** Settings panel: download every image and sound to play without a connection. */
export function OfflineDownload() {
  const t = useT()
  const online = useOnline()
  const [manifest, setManifest] = useState<MediaManifest | null>(null)
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!offlineSupported()) return
    void fetchMediaManifest().then((value) => {
      setManifest(value)
      setReady(Boolean(value && offlineReadyVersion() === value.version))
    })
  }, [])

  if (!offlineSupported()) return null

  const megabytes = manifest ? Math.round(manifest.bytes / 1_000_000) : null

  const start = () => {
    if (!manifest) return
    playSound('button')
    setBusy(true)
    setProgress({ done: 0, total: manifest.urls.length, failed: 0 })
    void downloadAllMedia(manifest, setProgress)
      .then((final) => setReady(final.failed === 0))
      .finally(() => setBusy(false))
  }

  const failed = progress && !busy && progress.failed > 0

  return (
    <section className="settings-group">
      <h2>{t('offlineTitle')}</h2>
      <p className="settings-help">{t('offlineHelp')}</p>

      {ready ? (
        <p className="offline-ready">{t('offlineReady')}</p>
      ) : (
        <>
          {progress && (
            <div className="offline-progress" aria-hidden="true">
              <span
                style={
                  { '--done': progress.total ? progress.done / progress.total : 0 } as CSSProperties
                }
              />
            </div>
          )}
          {busy && progress && (
            <p className="settings-help" role="status">
              {t('offlineProgress', { a: progress.done, b: progress.total })}
            </p>
          )}
          {failed && <p className="cloud-form-error">{t('offlineFailed', { n: progress.failed })}</p>}
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || !manifest || !online}
            onClick={start}
          >
            {megabytes !== null
              ? t('offlineDownload', { n: megabytes })
              : t('offlineDownloadPlain')}
          </button>
          {!online && <p className="settings-help">{t('offlineNeedsConnection')}</p>}
        </>
      )}
    </section>
  )
}
