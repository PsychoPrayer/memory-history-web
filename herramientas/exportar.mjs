/**
 * Exporta el contenido del proyecto Unity (MemoryHistory2) a JSON consumible
 * por la app de React.
 *
 * Uso:  node herramientas/exportar.mjs
 *       node herramientas/exportar.mjs --pais=ES
 *
 * La ruta al proyecto Unity se puede cambiar con la variable de entorno
 * UNITY_PROJECT.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ_WEB = join(AQUI, '..')

const RAIZ_UNITY =
  process.env.UNITY_PROJECT ?? 'C:/Users/TechP/memoryhistory2/MemoryHistory2'
const RAIZ_ASSETS = join(RAIZ_UNITY, 'Assets')

const PAIS = (argumento('pais') ?? 'VE').toUpperCase()

/** Carpetas que nunca contienen contenido y sí muchísimos archivos. */
const IGNORADAS = new Set([
  'Library',
  'Temp',
  'Obj',
  'obj',
  'Build',
  'Builds',
  'Logs',
  'UserSettings',
  '.git',
  '.vs',
])

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function argumento(nombre) {
  const encontrado = process.argv.find((a) => a.startsWith(`--${nombre}=`))
  return encontrado ? encontrado.split('=')[1] : undefined
}

function* recorrer(carpeta) {
  let entradas
  try {
    entradas = readdirSync(carpeta, { withFileTypes: true })
  } catch {
    return
  }
  for (const entrada of entradas) {
    const ruta = join(carpeta, entrada.name)
    if (entrada.isDirectory()) {
      if (IGNORADAS.has(entrada.name)) continue
      yield* recorrer(ruta)
    } else {
      yield ruta
    }
  }
}

/**
 * Unity escribe YAML 1.1 con una etiqueta propia en la cabecera del documento.
 * Quitándola, el resto es YAML corriente que js-yaml entiende, incluidos los
 * escapes tipo \xED y el plegado de líneas largas.
 */
function leerAsset(ruta) {
  const crudo = readFileSync(ruta, 'utf8')
  const limpio = crudo
    .replace(/^%YAML.*$/gm, '')
    .replace(/^%TAG.*$/gm, '')
    .replace(/^--- !u!\d+ &-?\d+.*$/gm, '---')
  const documento = yaml.load(limpio, { json: true })
  if (!documento || typeof documento !== 'object') return null
  // El único valor de primer nivel es MonoBehaviour (o similar).
  return Object.values(documento)[0] ?? null
}

function quitarAcentos(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function babosa(texto) {
  return quitarAcentos(String(texto))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Normaliza los saltos de línea de Unity y recorta espacio sobrante. */
function limpiarTexto(valor) {
  if (valor === null || valor === undefined) return ''
  return String(valor)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function texto(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim()
}

function numero(valor, porDefecto = 0) {
  const n = Number(valor)
  return Number.isFinite(n) ? n : porDefecto
}

function booleano(valor) {
  return valor === 1 || valor === true || valor === '1'
}

// ---------------------------------------------------------------------------
// Mapa de GUID a ruta de archivo
// ---------------------------------------------------------------------------

const porGuid = new Map()

/**
 * Los `.asset` sueltos se buscan por nombre, no por ruta. Las carpetas de
 * Unity se reorganizan a menudo y una ruta fija solo sirve hasta que alguien
 * mueve algo; el nombre del ScriptableObject, en cambio, es estable.
 */
const porNombreAsset = new Map()

function construirMapaDeGuids() {
  for (const ruta of recorrer(RAIZ_ASSETS)) {
    if (ruta.endsWith('.asset')) {
      const nombre = basename(ruta, '.asset')
      if (!porNombreAsset.has(nombre)) porNombreAsset.set(nombre, [])
      porNombreAsset.get(nombre).push(ruta)
      continue
    }
    if (!ruta.endsWith('.meta')) continue
    let cabecera
    try {
      cabecera = readFileSync(ruta, 'utf8').slice(0, 200)
    } catch {
      continue
    }
    const coincidencia = cabecera.match(/^guid:\s*([0-9a-f]{32})/m)
    if (coincidencia) porGuid.set(coincidencia[1], ruta.slice(0, -'.meta'.length))
  }
}

/** Busca un ScriptableObject por su nombre de archivo, sin extensión. */
function buscarAsset(nombre, obligatorio = true) {
  const candidatos = porNombreAsset.get(nombre)
  if (!candidatos || candidatos.length === 0) {
    if (!obligatorio) return null
    throw new Error(
      `No encuentro ningún "${nombre}.asset" bajo ${RAIZ_ASSETS}. ` +
        'Comprueba UNITY_PROJECT o si el asset cambió de nombre.',
    )
  }
  if (candidatos.length > 1) {
    avisar(`Hay ${candidatos.length} archivos "${nombre}.asset"; uso ${candidatos[0]}`)
  }
  return leerAsset(candidatos[0])
}

function rutaDe(referencia) {
  if (!referencia || typeof referencia !== 'object') return null
  return porGuid.get(referencia.guid) ?? null
}

function assetDe(referencia) {
  const ruta = rutaDe(referencia)
  if (!ruta) return null
  try {
    return leerAsset(ruta)
  } catch {
    return null
  }
}

/** Devuelve el primer array de referencias con GUID que encuentre en el objeto. */
function referenciasDe(objeto, ...clavesPreferidas) {
  for (const clave of clavesPreferidas) {
    const valor = objeto?.[clave]
    if (Array.isArray(valor) && valor.length) return valor
  }
  for (const valor of Object.values(objeto ?? {})) {
    if (Array.isArray(valor) && valor.length && valor[0]?.guid) return valor
  }
  return []
}

// ---------------------------------------------------------------------------
// Manifiesto de imágenes
// ---------------------------------------------------------------------------

const imagenes = new Map() // destino -> origen
const destinoPorOrigen = new Map()

/**
 * Registra una imagen para que el script de conversión la procese y devuelve
 * la URL pública con la que la app la referenciará.
 */
function registrarImagen(referencia, categoria, nombreDeseado) {
  const origen = rutaDe(referencia)
  if (!origen) return null

  const yaRegistrada = destinoPorOrigen.get(origen)
  if (yaRegistrada) return yaRegistrada

  let raiz = babosa(nombreDeseado || basename(origen).replace(/\.[^.]+$/, ''))
  if (!raiz) raiz = 'imagen'

  let destino = `${categoria}/${raiz}.webp`
  let contador = 2
  while (imagenes.has(destino)) {
    destino = `${categoria}/${raiz}-${contador}.webp`
    contador += 1
  }

  imagenes.set(destino, origen)
  const url = `/imagenes/${destino}`
  destinoPorOrigen.set(origen, url)
  return url
}

// ---------------------------------------------------------------------------
// Localización de las bases de datos del país
// ---------------------------------------------------------------------------

function baseDeContenido() {
  const asset = buscarAsset('CountryContentDatabase')

  const entradas = asset?.entries ?? asset?.countryContents ?? asset?.contents ?? []
  const entrada = entradas.find(
    (e) => texto(e.countryId).toUpperCase() === PAIS,
  )
  if (!entrada) {
    const disponibles = entradas.map((e) => texto(e.countryId)).join(', ')
    throw new Error(`El país ${PAIS} no está en la base. Disponibles: ${disponibles}`)
  }
  return entrada
}

function paisDe(codigo) {
  const asset = buscarAsset('CountryDatabase', false)
  const referencias = referenciasDe(asset, 'countries')
  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (datos && texto(datos.countryId).toUpperCase() === codigo) return datos
  }
  return null
}

// ---------------------------------------------------------------------------
// Exportadores por tipo de contenido
// ---------------------------------------------------------------------------

function exportarCartas(referenciaBase) {
  return exportarBarajaDe(assetDe(referenciaBase))
}

/**
 * Pancitolandia es un país más a efectos de baraja: tiene su propia
 * CardDatabase con los pancitos, pero ni niveles ni historias, así que no se
 * puede jugar la campaña con él. Solo aparece en el modo libre.
 */
function exportarPancitolandia() {
  const base = buscarAsset('PLCardDatabase', false)
  if (!base) {
    avisar('No encuentro PLCardDatabase; Pancitolandia se queda sin baraja.')
    return []
  }
  return exportarBarajaDe(base)
}

function exportarBarajaDe(base) {
  const referencias = referenciasDe(base, 'cards')
  const cartas = []
  const vistas = new Map()
  let sinResolver = 0

  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (!datos) {
      sinResolver += 1
      continue
    }

    const id = texto(datos.cardId)
    const nombre = texto(datos.cardName)

    // La base de España lista la carta 71 dos veces. Sin deduplicar, el
    // repartidor puede sacar la misma estampa en dos parejas y el tablero
    // acaba con cuatro cartas idénticas.
    if (vistas.has(id)) {
      avisar(`Carta duplicada en la base: ${id} (${nombre}). Me quedo con la primera.`)
      continue
    }
    vistas.set(id, nombre)

    cartas.push({
      id,
      nombre,
      imagen: registrarImagen(datos.cardImage, 'cartas', nombre),
      desbloqueoEn: numero(datos.unlockAtCardCount, 12),
    })
  }

  if (sinResolver) {
    avisar(`${sinResolver} cartas referenciadas no existen en disco y se han omitido.`)
  }
  avisarDeCartasHuerfanas(referencias)
  return cartas
}

/**
 * Comprueba si la carpeta de cartas tiene archivos que la base no lista. Le
 * pasa a España con la carta 72 (Quebrantahuesos): está en disco, tiene imagen
 * y nunca sale en el juego porque nadie la añadió a la base.
 */
function avisarDeCartasHuerfanas(referencias) {
  const rutas = referencias.map((r) => rutaDe(r)).filter(Boolean)
  if (rutas.length === 0) return

  const carpeta = dirname(rutas[0])
  const enLaBase = new Set(rutas)

  let huerfanas
  try {
    huerfanas = readdirSync(carpeta)
      .filter((nombre) => nombre.endsWith('.asset'))
      .map((nombre) => join(carpeta, nombre))
      .filter((ruta) => !enLaBase.has(ruta))
  } catch {
    return
  }

  for (const ruta of huerfanas) {
    avisar(`${basename(ruta)} está en disco pero no en la base; no se exporta.`)
  }
}

function exportarNiveles(referenciaBase) {
  const base = assetDe(referenciaBase)
  const referencias = referenciasDe(base, 'levels')
  const niveles = []

  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (!datos) continue

    niveles.push({
      id: texto(datos.levelId),
      nombre: texto(datos.levelName),
      numero: numero(datos.levelNumber),
      cartas: numero(datos.cardCount, 12),
      dificil: booleano(datos.isHard),
      columnas: numero(datos.gridColumns, 3),
      filas: numero(datos.gridRows, 4),
      segundos: numero(datos.timeLimit),
      vistazoSeg: numero(datos.cardRevealTime),
      volteoSeg: numero(datos.cardFlipDuration, 0.3),
      errores: {
        tres: numero(datos.maxMistakesFor3Stars),
        dos: numero(datos.maxMistakesFor2Stars),
        una: numero(datos.maxMistakesFor1Star),
      },
      historiaPremio: texto(datos.rewardStoryId) || null,
      requisito: texto(datos.unlockRequirement) || null,
      abiertoPorDefecto: booleano(datos.isUnlockedByDefault),
      // Hay siete reversos y los comparten los tres países, así que
      // registrarImagen los deduplica hasta dejar siete archivos.
      reverso: registrarImagen(datos.cardBack, 'reversos'),
    })
  }

  niveles.sort((a, b) => a.numero - b.numero)
  return niveles
}

function exportarHistorias(referenciaBase) {
  const base = assetDe(referenciaBase)
  const referencias = referenciasDe(base, 'stories')
  const historias = []

  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (!datos) continue

    const titulo = texto(datos.storyTitle)
    // La versión sin cinta adhesiva es la que se usa cuando existe.
    const imagen =
      registrarImagen(datos.storyImageWithoutTape, 'historias', titulo) ??
      registrarImagen(datos.storyImage, 'historias', titulo)

    historias.push({
      id: texto(datos.storyId),
      titulo,
      imagen,
      es: {
        presentacion: limpiarTexto(datos.presentationMessage),
        texto: paginasDe(datos.storyTextPages, datos.storyText, datos.storyDescription),
      },
      en: {
        presentacion: limpiarTexto(datos.presentationMessageEnglish),
        texto: paginasDe(
          datos.storyTextPagesEnglish,
          datos.storyTextEnglish,
          datos.storyDescriptionEnglish,
        ),
      },
      nivelDesbloqueo: texto(datos.unlockLevelId) || null,
      abiertaPorDefecto: booleano(datos.isUnlockedByDefault),
    })
  }

  historias.sort((a, b) => Number(a.id) - Number(b.id))
  return historias
}

/**
 * El texto de la historia puede vivir en tres sitios. En la práctica casi
 * siempre está en la descripción; las páginas están declaradas pero vacías.
 */
function paginasDe(paginas, textoSuelto, descripcion) {
  if (Array.isArray(paginas)) {
    const utiles = paginas.map(limpiarTexto).filter(Boolean)
    if (utiles.length) return utiles
  }
  const alternativa = limpiarTexto(textoSuelto) || limpiarTexto(descripcion)
  return alternativa ? [alternativa] : []
}

function exportarPreguntas(referenciaBase) {
  const base = assetDe(referenciaBase)
  const referencias = referenciasDe(base, 'questions')
  const preguntas = []

  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (!datos) continue

    const opcionesEs = (datos.answerOptions ?? []).map(texto)
    const opcionesEn = (datos.answerOptionsEnglish ?? []).map(texto)

    preguntas.push({
      id: texto(datos.questionId),
      historia: normalizarIdHistoria(datos.storyId),
      numero: numero(datos.questionNumber, 1),
      correcta: numero(datos.correctAnswerIndex),
      es: { enunciado: limpiarTexto(datos.questionText), opciones: opcionesEs },
      en: {
        enunciado: limpiarTexto(datos.questionTextEnglish),
        opciones: opcionesEn.length ? opcionesEn : opcionesEs,
      },
    })
  }

  return preguntas
}

/** Los identificadores de historia aparecen como "17", "story17" o "17.1". */
function normalizarIdHistoria(valor) {
  const crudo = texto(valor).toLowerCase().replace(/^story/, '')
  const entero = parseInt(crudo, 10)
  return Number.isFinite(entero) ? String(entero) : crudo
}

function exportarTests(referenciaBase) {
  const base = assetDe(referenciaBase)
  const referencias = referenciasDe(base, 'tests')
  const tests = []

  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (!datos) continue
    tests.push({
      nivel: numero(datos.testLevel, 1),
      nombre: texto(datos.testName),
      desdeHistoria: numero(datos.startStoryNumber, 1),
      hastaHistoria: numero(datos.endStoryNumber, 10),
      preguntas: numero(datos.questionCount, 10),
      segundos: numero(datos.timeLimit),
    })
  }

  tests.sort((a, b) => a.nivel - b.nivel)
  return tests
}

function exportarLogros(referenciaBase) {
  const base = assetDe(referenciaBase)
  const referencias = referenciasDe(base, 'achievements')
  const logros = []

  for (const referencia of referencias) {
    const datos = assetDe(referencia)
    if (!datos) continue
    const id = texto(datos.achievementId)
    logros.push({
      id,
      es: {
        titulo: texto(datos.achievementTitle),
        descripcion: limpiarTexto(datos.achievementDescription),
      },
      en: {
        titulo: texto(datos.achievementTitleEnglish) || texto(datos.achievementTitle),
        descripcion:
          limpiarTexto(datos.achievementDescriptionEnglish) ||
          limpiarTexto(datos.achievementDescription),
      },
      tipo: numero(datos.achievementType),
      objetivo: numero(datos.targetValue, 1),
      conProgreso: booleano(datos.isProgressBased),
      icono: registrarImagen(datos.achievementIcon, 'logros', id),
    })
  }

  return logros
}

function exportarMensajesDeSeccion() {
  const asset = buscarAsset('SectionCompleteMessagesConfig', false)
  if (!asset) return []

  const entradas = asset.messages ?? asset.entries ?? []
  return entradas.map((entrada) => {
    const cartas = numero(entrada.cardCount, 12)
    return {
      cartas,
      es: limpiarTexto(entrada.messageSpanish),
      en: limpiarTexto(entrada.messageEnglish),
      imagen: registrarImagen(entrada.image, 'secciones', `seccion-${cartas}`),
    }
  })
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

const avisos = []
function avisar(mensaje) {
  avisos.push(mensaje)
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

function principal() {
  console.log(`Proyecto Unity: ${RAIZ_UNITY}`)
  console.log(`País: ${PAIS}`)

  process.stdout.write('Indexando GUIDs... ')
  construirMapaDeGuids()
  console.log(`${porGuid.size} archivos`)

  const contenido = baseDeContenido()
  const datosPais = paisDe(PAIS)

  const cartas = exportarCartas(contenido.cardDatabase)
  const niveles = exportarNiveles(contenido.levelDatabase)
  const historias = exportarHistorias(contenido.storyDatabase)
  const preguntas = exportarPreguntas(contenido.questionDatabase)
  const tests = exportarTests(contenido.testDatabase)
  const logros = exportarLogros(contenido.achievementDatabase)
  const secciones = exportarMensajesDeSeccion()
  const pancitos = exportarPancitolandia()

  // Un reverso por tamaño de tablero. Los tres países comparten los siete.
  const reversos = {}
  for (const nivel of niveles) {
    if (nivel.reverso && !reversos[nivel.cartas]) reversos[nivel.cartas] = nivel.reverso
  }

  const pais = {
    id: PAIS,
    es: texto(datosPais?.countryName) || PAIS,
    en: texto(datosPais?.countryNameEnglish) || texto(datosPais?.countryName) || PAIS,
    bandera: registrarImagen(datosPais?.countryFlag, 'banderas', PAIS),
  }

  // Un tablero de N cartas necesita N/2 estampas distintas, y solo puede tirar
  // de las que se desbloquean en ese tamaño o antes. España se quedó a medias
  // de cartas, así que conviene comprobarlo por sección.
  for (const tamano of [...new Set(niveles.map((n) => n.cartas))].sort((a, b) => a - b)) {
    const disponibles = cartas.filter((c) => c.desbloqueoEn <= tamano).length
    if (disponibles < tamano / 2) {
      avisar(
        `Los tableros de ${tamano} cartas piden ${tamano / 2} estampas distintas ` +
          `y solo hay ${disponibles} disponibles.`,
      )
    }
  }

  // Comprobaciones que conviene ver antes de construir sobre estos datos.
  const conHistoria = niveles.filter((n) => n.historiaPremio).length
  if (conHistoria !== historias.length) {
    avisar(
      `${conHistoria} niveles premian historia pero hay ${historias.length} historias exportadas.`,
    )
  }
  const idsDeHistoria = new Set(historias.map((h) => h.id))
  const huerfanas = preguntas.filter((p) => !idsDeHistoria.has(p.historia))
  if (huerfanas.length) {
    avisar(`${huerfanas.length} preguntas apuntan a historias que no existen.`)
  }
  const sinImagen = cartas.filter((c) => !c.imagen).length
  if (sinImagen) avisar(`${sinImagen} cartas se han quedado sin imagen.`)

  const carpeta = join(RAIZ_WEB, 'src', 'contenido', PAIS.toLowerCase())
  mkdirSync(carpeta, { recursive: true })

  escribir(join(carpeta, 'pais.json'), pais)
  escribir(join(carpeta, 'cartas.json'), cartas)
  escribir(join(carpeta, 'niveles.json'), niveles)
  escribir(join(carpeta, 'historias.json'), historias)
  escribir(join(carpeta, 'preguntas.json'), preguntas)
  escribir(join(carpeta, 'tests.json'), tests)
  escribir(join(carpeta, 'logros.json'), logros)
  escribir(join(carpeta, 'secciones.json'), secciones)

  // Contenido común a todos los países: se reescribe igual en cada pasada.
  const comun = join(RAIZ_WEB, 'src', 'contenido')
  mkdirSync(join(comun, 'pl'), { recursive: true })
  escribir(join(comun, 'pl', 'cartas.json'), pancitos)
  escribir(join(comun, 'reversos.json'), reversos)

  mkdirSync(join(RAIZ_WEB, 'herramientas'), { recursive: true })
  escribir(
    join(RAIZ_WEB, 'herramientas', `imagenes-${PAIS.toLowerCase()}.json`),
    Object.fromEntries([...imagenes].sort()),
  )

  console.log('')
  console.log(`  cartas      ${cartas.length}`)
  console.log(`  niveles     ${niveles.length}`)
  console.log(`  historias   ${historias.length}`)
  console.log(`  preguntas   ${preguntas.length}`)
  console.log(`  tests       ${tests.length}`)
  console.log(`  logros      ${logros.length}`)
  console.log(`  secciones   ${secciones.length}`)
  console.log(`  pancitos    ${pancitos.length}`)
  console.log(`  reversos    ${Object.keys(reversos).length}`)
  console.log(`  imagenes    ${imagenes.size}`)
  console.log('')
  console.log(`Escrito en src/contenido/${PAIS.toLowerCase()}/`)

  if (avisos.length) {
    console.log('')
    console.log('Avisos:')
    for (const aviso of avisos) console.log(`  - ${aviso}`)
  }
}

function escribir(ruta, datos) {
  writeFileSync(ruta, `${JSON.stringify(datos, null, 2)}\n`, 'utf8')
}

principal()
