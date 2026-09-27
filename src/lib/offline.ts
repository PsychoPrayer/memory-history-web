import { useEffect, useState } from 'react'

/**
 * Offline play for the web build. The service worker (dist/sw.js) keeps the app
 * shell and every image or sound already seen; downloadAllMedia() fetches the
 * rest so the whole game works without a connection. Native builds ship all
 * files inside the app, so none of this runs there.
 */

const READY_KEY = 'memoryhistory.offlineReady'

export function offlineSupported(): boolean {
  return (
    import.meta.env.PROD &&
    import.meta.env.BASE_URL === '/' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  )
}

type UpdateListener = (ready: boolean) => void
const updateListeners = new Set<UpdateListener>()
let waiting: ServiceWorker | null = null

function announceUpdate(worker: ServiceWorker | null) {
  waiting = worker
  for (const listener of updateListeners) listener(Boolean(worker))
}

export function registerServiceWorker() {
  if (!offlineSupported()) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => {
      /* A first install has no controller yet: that is not an "update". */
      if (registration.waiting && navigator.serviceWorker.controller) {
        announceUpdate(registration.waiting)
      }
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            announceUpdate(worker)
          }
        })
      })
      /* Check again whenever the player comes back to the tab. */
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    })

    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    })
  })
}

export function useUpdateAvailable(): boolean {
  const [ready, setReady] = useState(Boolean(waiting))
  useEffect(() => {
    updateListeners.add(setReady)
    return () => {
      updateListeners.delete(setReady)
    }
  }, [])
  return ready
}

export function applyUpdate() {
  waiting?.postMessage({ type: 'SKIP_WAITING' })
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export interface MediaManifest {
  version: string
  bytes: number
  urls: string[]
}

export async function fetchMediaManifest(): Promise<MediaManifest | null> {
  try {
    const response = await fetch('/offline-media.json', { cache: 'no-store' })
    return response.ok ? ((await response.json()) as MediaManifest) : null
  } catch {
    return null
  }
}

export function offlineReadyVersion(): string | null {
  try {
    return localStorage.getItem(READY_KEY)
  } catch {
    return null
  }
}

export interface DownloadProgress {
  done: number
  total: number
  failed: number
}

/** Caches every image and sound; resolves when the service worker reports the last one. */
export async function downloadAllMedia(
  manifest: MediaManifest,
  onProgress: (progress: DownloadProgress) => void,
): Promise<DownloadProgress> {
  /* Ask the browser not to evict the files under storage pressure. */
  void navigator.storage?.persist?.()
  const registration = await navigator.serviceWorker.ready
  const worker = navigator.serviceWorker.controller ?? registration.active
  if (!worker) throw new Error('Service worker not active')

  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string } & DownloadProgress
      if (data?.type !== 'CACHE_MEDIA_PROGRESS') return
      onProgress(data)
      if (data.done >= data.total) {
        navigator.serviceWorker.removeEventListener('message', onMessage)
        if (data.failed === 0) {
          try {
            localStorage.setItem(READY_KEY, manifest.version)
          } catch {
            /* private mode: the files are still cached */
          }
        }
        resolve(data)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    worker.postMessage({ type: 'CACHE_MEDIA', urls: manifest.urls })
  })
}
