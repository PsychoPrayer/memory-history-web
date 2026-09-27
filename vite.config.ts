import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin, type ResolvedConfig } from 'vite'
import react from '@vitejs/plugin-react'

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path) : [path]
  })
}

/**
 * Web builds only: writes dist/sw.js (app shell list + build version) and
 * dist/offline-media.json (every image and sound, for the "play offline"
 * download). Native builds bundle everything already and skip this.
 */
function offlineServiceWorker(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'memory-history-offline',
    apply: 'build',
    configResolved(resolved) {
      config = resolved
    },
    closeBundle() {
      if (config.base !== '/') return
      const outDir = config.build.outDir
      const files = listFiles(outDir).map((path) => ({
        url: `/${relative(outDir, path).split(sep).join('/')}`,
        size: statSync(path).size,
      }))

      const shell = files
        .filter(
          ({ url }) =>
            url.startsWith('/assets/') ||
            url.startsWith('/icons/') ||
            url === '/index.html' ||
            url === '/manifest.webmanifest',
        )
        .map(({ url }) => url)
      const media = files.filter(
        ({ url }) => url.startsWith('/imagenes/') || url.startsWith('/audio/'),
      )

      const version = createHash('sha256')
        .update(shell.join('|'))
        .update(readFileSync(join(outDir, 'index.html')))
        .digest('hex')
        .slice(0, 12)

      const template = readFileSync(join(config.root, 'src', 'sw-template.js'), 'utf8')
      writeFileSync(
        join(outDir, 'sw.js'),
        template
          .replace('__VERSION__', version)
          .replace('__SHELL__', JSON.stringify(['/', ...shell])),
      )
      writeFileSync(
        join(outDir, 'offline-media.json'),
        JSON.stringify({
          version,
          bytes: media.reduce((sum, file) => sum + file.size, 0),
          urls: media.map((file) => file.url),
        }),
      )
    },
  }
}

export default defineConfig(({ mode }) => ({
  /*
   * Web: absolute URLs so deep links (/game/…, /levels/16) load their assets.
   * Native (npm run build:native): relative URLs for the Capacitor bundle.
   */
  base: mode === 'native' ? './' : '/',
  plugins: [react(), offlineServiceWorker()],
  server: {
    port: 5173,
    host: true,
  },
}))
