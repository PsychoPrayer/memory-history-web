/* Memory History service worker. Generated at build time from src/sw-template.js. */

const VERSION = '__VERSION__'
const SHELL = __SHELL__
const SHELL_CACHE = `mh-shell-${VERSION}`
/* Media URLs never change meaning between builds, so this cache survives updates. */
const MEDIA_CACHE = 'mh-media-v1'
const FONT_CACHE = 'mh-fonts-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith('mh-shell-') && name !== SHELL_CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('message', (event) => {
  const data = event.data || {}
  if (data.type === 'SKIP_WAITING') self.skipWaiting()
  if (data.type === 'CACHE_MEDIA') event.waitUntil(cacheMedia(data.urls || [], event.source))
})

/** Downloads media for offline play, reporting progress to the page that asked. */
async function cacheMedia(urls, client) {
  const cache = await caches.open(MEDIA_CACHE)
  let done = 0
  let failed = 0
  const queue = [...urls]
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift()
      try {
        if (!(await cache.match(url))) {
          const response = await fetch(url)
          if (!response.ok) throw new Error(String(response.status))
          await cache.put(url, response)
        }
      } catch {
        failed += 1
      }
      done += 1
      if (client && (done % 10 === 0 || done === urls.length)) {
        client.postMessage({ type: 'CACHE_MEDIA_PROGRESS', done, total: urls.length, failed })
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
      event.respondWith(staleWhileRevalidate(request, FONT_CACHE))
    }
    /* Everything else: always live. */
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request))
    return
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  if (url.pathname.startsWith('/imagenes/') || url.pathname.startsWith('/audio/')) {
    event.respondWith(
      request.headers.has('range') ? rangeFromCache(request) : cacheFirst(request, MEDIA_CACHE),
    )
  }
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const key = new URL(request.url).pathname
  const hit = (await cache.match(key)) || (await caches.match(key))
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok && response.status === 200) cache.put(key, response.clone())
  return response
}

/* The SPA shell: fresh when online, the cached copy when offline. */
async function networkFirstPage(request) {
  try {
    const response = await fetch(request)
    return response
  } catch {
    const cache = await caches.open(SHELL_CACHE)
    return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error()
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => hit)
  return hit || refresh
}

/* <audio> asks for byte ranges; Safari needs a real 206 even from the cache. */
async function rangeFromCache(request) {
  const key = new URL(request.url).pathname
  const cache = await caches.open(MEDIA_CACHE)
  let full = await cache.match(key)
  if (!full) {
    try {
      const response = await fetch(key)
      if (response.ok) {
        await cache.put(key, response.clone())
        full = response
      }
    } catch {
      /* offline and not cached */
    }
  }
  if (!full) return fetch(request)

  const body = await full.arrayBuffer()
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') || '')
  const size = body.byteLength
  const start = match && match[1] ? Number(match[1]) : 0
  const end = match && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}
