/**
 * App icons for the home screen, browser tab and the web manifest:
 * Pancito on aged paper, framed by a leather-and-gold ring.
 *
 * Uso: node tools/icons.mjs
 */

import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const AQUI = dirname(fileURLToPath(import.meta.url))
const PUBLICO = join(AQUI, '..', 'public')
const DESTINO = join(PUBLICO, 'icons')
const PANCITO = join(PUBLICO, 'imagenes', 'ui', 'pancito', 'happy.webp')

/** Paper disc on leather; `inset` leaves room for maskable safe zones. */
function fondo(size, { inset = 0, ring = true } = {}) {
  const r = size / 2
  const paper = r - inset
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <radialGradient id="p" cx="45%" cy="38%" r="70%">
      <stop offset="0" stop-color="#fbf4e2"/>
      <stop offset="0.7" stop-color="#e8dcc0"/>
      <stop offset="1" stop-color="#c9b58c"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="#3a2a1a"/>
  <circle cx="${r}" cy="${r}" r="${paper}" fill="url(#p)"/>
  ${ring ? `<circle cx="${r}" cy="${r}" r="${paper - size * 0.02}" fill="none" stroke="#c99f45" stroke-width="${size * 0.018}"/>` : ''}
</svg>`)
}

async function icono(size, name, { inset = 0, scale = 0.82, square = false } = {}) {
  const art = Math.round((size - inset * 2) * scale)
  /* The sprite has wide transparent margins: trim them so Pancito fills the icon. */
  const trimmed = await sharp(PANCITO).trim().toBuffer()
  const pancito = await sharp(trimmed)
    .resize(art, art, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  let base = sharp(fondo(size, { inset, ring: !square }))
  if (square) {
    base = sharp({
      create: { width: size, height: size, channels: 4, background: '#e8dcc0' },
    })
  }
  await base
    .composite([{ input: pancito, gravity: 'center' }])
    .png()
    .toFile(join(DESTINO, name))
  console.log('✓', name)
}

async function principal() {
  mkdirSync(DESTINO, { recursive: true })
  await icono(512, 'icon-512.png', { scale: 0.7 })
  await icono(192, 'icon-192.png', { scale: 0.7 })
  /* Maskable: Android crops to a circle or squircle, so keep art in the inner 80%. */
  await icono(512, 'icon-maskable-512.png', { scale: 0.56 })
  /* iOS rounds the corners itself and ignores transparency: full-bleed square. */
  await icono(180, 'apple-touch-icon.png', { square: true, scale: 0.8 })
  await icono(64, 'favicon-64.png', { scale: 0.78 })
}

principal().catch((error) => {
  console.error(error)
  process.exit(1)
})
