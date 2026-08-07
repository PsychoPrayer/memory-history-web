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
const CONTENIDO = join(RAIZ, 'src', 'contenido')

const PAISES = ['ve', 'es', 'eu']

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
  const carpeta = join(CONTENIDO, codigo)
  if (!existsSync(carpeta)) {
    entrada.avisos.push(`Sin carpeta src/contenido/${codigo}`)
    return
  }

  const pais = leerJson(join(carpeta, 'pais.json'))
  const cartas = leerJson(join(carpeta, 'cartas.json')) ?? []
  const historias = leerJson(join(carpeta, 'historias.json')) ?? []
  const logros = leerJson(join(carpeta, 'logros.json')) ?? []

  if (pais?.bandera) {
    copiar(urlARuta(pais.bandera), `${codigo}/bandera${extname(pais.bandera) || '.webp'}`, entrada)
  }

  for (const carta of cartas) {
    if (!carta.imagen) continue
    const ext = extname(carta.imagen) || '.webp'
    copiar(urlARuta(carta.imagen), `${codigo}/cartas/${carta.id}${ext}`, entrada)
  }

  for (const historia of historias) {
    if (!historia.imagen) continue
    const ext = extname(historia.imagen) || '.webp'
    copiar(urlARuta(historia.imagen), `${codigo}/historias/${historia.id}${ext}`, entrada)
  }

  for (const logro of logros) {
    if (!logro.icono) continue
    const ext = extname(logro.icono) || '.webp'
    copiar(urlARuta(logro.icono), `${codigo}/logros/${logro.id}${ext}`, entrada)
  }

  entrada.resumen[codigo] = {
    cartas: cartas.length,
    historias: historias.length,
    logros: logros.length,
  }
}

function empaquetarPancitos(entrada) {
  const cartas = leerJson(join(CONTENIDO, 'pl', 'cartas.json'))
  if (!cartas) {
    entrada.avisos.push('Sin baraja de Pancitolandia (src/contenido/pl/cartas.json)')
    return
  }

  for (const carta of cartas) {
    if (!carta.imagen) continue
    const ext = extname(carta.imagen) || '.webp'
    copiar(urlARuta(carta.imagen), `pl/cartas/${carta.id}${ext}`, entrada)
  }

  entrada.resumen.pl = { cartas: cartas.length }
}

function empaquetarReversos(entrada) {
  const reversos = leerJson(join(CONTENIDO, 'reversos.json'))
  if (!reversos) {
    entrada.avisos.push('Sin reversos.json — vuelve a exportar un país')
    return
  }

  for (const [cartas, url] of Object.entries(reversos)) {
    const ext = extname(url) || '.webp'
    copiar(urlARuta(url), `comunes/reversos/${cartas}${ext}`, entrada)
  }

  entrada.resumen.reversos = Object.keys(reversos).length
}

function principal() {
  if (!existsSync(ORIGEN_IMG)) {
    console.error(
      'No hay public/imagenes. Ejecuta antes "npm run contenido" (y exporta ES/EU si quieres).',
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

  for (const codigo of PAISES) empaquetarPais(codigo, entrada)
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
