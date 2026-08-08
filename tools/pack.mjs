/**
 * Empaqueta las imágenes ya convertidas para subirlas a una base de datos
 * (Supabase Storage u otro). No toca Unity: lee el JSON de src/contenido y
 * copia desde public/imagenes a empaquetado/ con nombres estables por id.
 *
 * Uso:  npm run empaquetar
 *
 * Estructura resultante:
 *
 *   empaquetado/
 *     manifiesto.json
 *     ve/cartas/{id}.webp
 *     ve/historias/{id}.webp
 *     ve/logros/{id}.webp
 *     ve/bandera.webp
 *     es/…  eu/…  pl/cartas/…
 *     comunes/reversos/{cartas}.webp
 *
 * El manifiesto lista cada archivo con país, categoría, id, nombre y la ruta
 * relativa que conviene usar como clave en el bucket.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = join(AQUI, '..')
const ORIGEN_IMG = join(RAIZ, 'public', 'imagenes')
const DESTINO = join(RAIZ, 'empaquetado')
const CONTENT = join(RAIZ, 'src', 'content')

const COUNTRIES = ['ve', 'es', 'eu']

function leerJson(ruta) {
  if (!existsSync(ruta)) return null
  return JSON.parse(readFileSync(ruta, 'utf8'))
}

function urlARuta(url) {
  if (!url || typeof url !== 'string') return null
  // "/imagenes/cartas/arepas.webp" → public/imagenes/cartas/arepas.webp
  const relativa = url.replace(/^\//, '').replace(/^imagenes\//, '')
  return join(ORIGEN_IMG, relativa)
}

function copiar(origen, destinoRelativo, entrada) {
  if (!origen || !existsSync(origen)) {
    entrada.faltantes.push(destinoRelativo)
    return null
  }

  const destino = join(DESTINO, destinoRelativo)
  mkdirSync(dirname(destino), { recursive: true })
  copyFileSync(origen, destino)

  const bytes = statSync(destino).size
  entrada.archivos.push({
    clave: destinoRelativo.replaceAll('\\', '/'),
    bytes,
    origen: origen.slice(RAIZ.length + 1).replaceAll('\\', '/'),
  })
  entrada.bytes += bytes
  return destinoRelativo.replaceAll('\\', '/')
}

function empaquetarPais(codigo, entrada) {
  const folder = join(CONTENT, codigo)
  if (!existsSync(folder)) {
    entrada.avisos.push(`Missing folder src/content/${codigo}`)
    return
  }

  const country = leerJson(join(folder, 'country.json'))
  const cards = leerJson(join(folder, 'cards.json')) ?? []
  const stories = leerJson(join(folder, 'stories.json')) ?? []
  const achievements = leerJson(join(folder, 'achievements.json')) ?? []

  if (country?.bandera) {
    copiar(urlARuta(country.bandera), `${codigo}/bandera${extname(country.bandera) || '.webp'}`, entrada)
  }

  for (const card of cards) {
    if (!card.imagen) continue
    const ext = extname(card.imagen) || '.webp'
    copiar(urlARuta(card.imagen), `${codigo}/cartas/${card.id}${ext}`, entrada)
  }

  for (const story of stories) {
    if (!story.imagen) continue
    const ext = extname(story.imagen) || '.webp'
    copiar(urlARuta(story.imagen), `${codigo}/historias/${story.id}${ext}`, entrada)
  }

  for (const achievement of achievements) {
    if (!achievement.icono) continue
    const ext = extname(achievement.icono) || '.webp'
    copiar(urlARuta(achievement.icono), `${codigo}/logros/${achievement.id}${ext}`, entrada)
  }

  entrada.resumen[codigo] = {
    cartas: cards.length,
    historias: stories.length,
    logros: achievements.length,
  }
}

function empaquetarPancitos(entrada) {
  const cards = leerJson(join(CONTENT, 'pl', 'cards.json'))
  if (!cards) {
    entrada.avisos.push('Missing Pancitolandia deck (src/content/pl/cards.json)')
    return
  }

  for (const card of cards) {
    if (!card.imagen) continue
    const ext = extname(card.imagen) || '.webp'
    copiar(urlARuta(card.imagen), `pl/cartas/${card.id}${ext}`, entrada)
  }

  entrada.resumen.pl = { cartas: cards.length }
}

function empaquetarReversos(entrada) {
  const backs = leerJson(join(CONTENT, 'backs.json'))
  if (!backs) {
    entrada.avisos.push('Missing backs.json — re-export a country')
    return
  }

  for (const [cards, url] of Object.entries(backs)) {
    const ext = extname(url) || '.webp'
    copiar(urlARuta(url), `comunes/reversos/${cards}${ext}`, entrada)
  }

  entrada.resumen.reversos = Object.keys(backs).length
}

function principal() {
  if (!existsSync(ORIGEN_IMG)) {
    console.error(
      'Missing public/imagenes. Run "npm run content" first (and export ES/EU if needed).',
    )
    process.exit(1)
  }

  if (existsSync(DESTINO)) rmSync(DESTINO, { recursive: true, force: true })
  mkdirSync(DESTINO, { recursive: true })

  const entrada = {
    generado: new Date().toISOString(),
    archivos: [],
    faltantes: [],
    avisos: [],
    resumen: {},
    bytes: 0,
  }

  for (const codigo of COUNTRIES) empaquetarPais(codigo, entrada)
  empaquetarPancitos(entrada)
  empaquetarReversos(entrada)

  const manifiesto = {
    generado: entrada.generado,
    totalArchivos: entrada.archivos.length,
    totalBytes: entrada.bytes,
    resumen: entrada.resumen,
    avisos: entrada.avisos,
    faltantes: entrada.faltantes,
    // Cada entrada: clave (ruta en el bucket), bytes, origen en public/
    archivos: entrada.archivos.sort((a, b) => a.clave.localeCompare(b.clave)),
    sugerenciaBucket: {
      ve: 'memory-history/ve',
      es: 'memory-history/es',
      eu: 'memory-history/eu',
      pl: 'memory-history/pl',
      comunes: 'memory-history/comunes',
    },
  }

  writeFileSync(
    join(DESTINO, 'manifiesto.json'),
    `${JSON.stringify(manifiesto, null, 2)}\n`,
    'utf8',
  )

  const mb = (entrada.bytes / 1024 / 1024).toFixed(1)
  console.log(`Empaquetado en empaquetado/`)
  console.log(`  archivos  ${entrada.archivos.length} (${mb} MB)`)
  for (const [clave, valor] of Object.entries(entrada.resumen)) {
    console.log(`  ${clave.padEnd(10)} ${JSON.stringify(valor)}`)
  }
  if (entrada.faltantes.length) {
    console.log(`  faltantes ${entrada.faltantes.length} (ver manifiesto.json)`)
  }
  for (const aviso of entrada.avisos) console.log(`  aviso: ${aviso}`)
}

principal()
