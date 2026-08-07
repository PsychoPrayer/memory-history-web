/**
 * Prepara los medios para la web: convierte a WebP las imágenes que el
 * exportador anotó en el manifiesto y copia las pistas de audio.
 *
 * Uso:  node herramientas/medios.mjs
 *       node herramientas/medios.mjs --pais=ES --rehacer
 *
 * Los originales son PNG de hasta 2346 píxeles de lado. En pantalla una carta
 * ocupa 280 como mucho, así que volcarlos tal cual costaría cientos de megas
 * de descarga para nada.
 */

import {
  readFileSync,
  copyFileSync,
  mkdirSync,
  existsSync,
  statSync,
  readdirSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ_WEB = join(AQUI, '..')
const RAIZ_UNITY =
  process.env.UNITY_PROJECT ?? 'C:/Users/TechP/memoryhistory2/MemoryHistory2'

const DESTINO_IMAGENES = join(RAIZ_WEB, 'public', 'imagenes')
const DESTINO_AUDIO = join(RAIZ_WEB, 'public', 'audio')

const PAIS = (argumento('pais') ?? 'VE').toLowerCase()
const REHACER = process.argv.includes('--rehacer')

/** Lado máximo y calidad por categoría. */
const AJUSTES = {
  cartas: { lado: 512, calidad: 82 },
  historias: { lado: 900, calidad: 82 },
  secciones: { lado: 900, calidad: 82 },
  logros: { lado: 256, calidad: 85 },
  banderas: { lado: 256, calidad: 88 },
  // Los reversos originales pesan 3 MB cada uno y nunca se ven a más de una
  // carta de ancho; 512 px sobran y bajan el total de 22 MB a menos de uno.
  reversos: { lado: 512, calidad: 80 },
}
const POR_DEFECTO = { lado: 512, calidad: 82 }

function argumento(nombre) {
  const encontrado = process.argv.find((a) => a.startsWith(`--${nombre}=`))
  return encontrado ? encontrado.split('=')[1] : undefined
}

function legible(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function convertirImagenes() {
  const manifiesto = join(RAIZ_WEB, 'herramientas', `imagenes-${PAIS}.json`)
  if (!existsSync(manifiesto)) {
    console.error(`No encuentro ${manifiesto}. Ejecuta antes el exportador.`)
    process.exit(1)
  }

  const entradas = Object.entries(JSON.parse(readFileSync(manifiesto, 'utf8')))
  console.log(`Imágenes: ${entradas.length} en el manifiesto`)

  let convertidas = 0
  let saltadas = 0
  let fallidas = 0
  let bytesEntrada = 0
  let bytesSalida = 0

  for (const [destinoRelativo, origen] of entradas) {
    const destino = join(DESTINO_IMAGENES, destinoRelativo)

    if (!REHACER && existsSync(destino)) {
      saltadas += 1
      bytesSalida += statSync(destino).size
      continue
    }
    if (!existsSync(origen)) {
      console.warn(`  falta el original: ${origen}`)
      fallidas += 1
      continue
    }

    const categoria = destinoRelativo.split('/')[0]
    const { lado, calidad } = AJUSTES[categoria] ?? POR_DEFECTO

    mkdirSync(dirname(destino), { recursive: true })
    try {
      await sharp(origen)
        .resize(lado, lado, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: calidad })
        .toFile(destino)

      bytesEntrada += statSync(origen).size
      bytesSalida += statSync(destino).size
      convertidas += 1
      if (convertidas % 25 === 0) process.stdout.write(`  ${convertidas} convertidas\n`)
    } catch (error) {
      console.warn(`  error con ${origen}: ${error.message}`)
      fallidas += 1
    }
  }

  console.log(`  convertidas ${convertidas}`)
  if (saltadas) console.log(`  ya estaban  ${saltadas} (usa --rehacer para forzar)`)
  if (fallidas) console.log(`  fallidas    ${fallidas}`)
  if (bytesEntrada) console.log(`  originales  ${legible(bytesEntrada)}`)
  console.log(`  resultado   ${legible(bytesSalida)}`)
}

function copiarAudio() {
  const origen = join(RAIZ_UNITY, 'Assets', 'Audios')
  if (!existsSync(origen)) {
    console.warn(`\nAudio: no encuentro ${origen}, lo salto.`)
    return
  }

  mkdirSync(DESTINO_AUDIO, { recursive: true })
  let copiados = 0
  let bytes = 0

  for (const nombre of readdirSync(origen)) {
    if (!/\.(mp3|ogg|wav)$/i.test(nombre)) continue
    const destino = join(DESTINO_AUDIO, nombre)
    copyFileSync(join(origen, nombre), destino)
    bytes += statSync(destino).size
    copiados += 1
  }

  console.log(`\nAudio: ${copiados} pistas copiadas, ${legible(bytes)}`)
}

async function principal() {
  await convertirImagenes()
  copiarAudio()
  console.log('\nListo. Todo en public/')
}

principal()
