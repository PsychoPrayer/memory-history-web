/**
 * Convierte las banderas rectangulares de tools/banderas-fuente/
 * a WebP en public/imagenes/banderas/.
 *
 * Uso: node tools/banderas.mjs
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const AQUI = dirname(fileURLToPath(import.meta.url))
const ORIGEN = join(AQUI, 'banderas-fuente')
const DESTINO = join(AQUI, '..', 'public', 'imagenes', 'banderas')

const CODIGOS = ['ve', 'es', 'eu']

async function principal() {
  if (!existsSync(ORIGEN)) {
    console.error(`No encuentro ${ORIGEN}`)
    process.exit(1)
  }

  mkdirSync(DESTINO, { recursive: true })

  for (const codigo of CODIGOS) {
    const fuente = readdirSync(ORIGEN).find((nombre) =>
      nombre.toLowerCase().startsWith(codigo),
    )
    if (!fuente) {
      console.warn(`Falta ${codigo}.* en banderas-fuente/`)
      continue
    }

    const destino = join(DESTINO, `${codigo}.webp`)
    await sharp(join(ORIGEN, fuente))
      .resize(480, 320, { fit: 'cover' })
      .webp({ quality: 92 })
      .toFile(destino)

    console.log(`ok ${codigo} ← ${fuente}`)
  }
}

principal()
