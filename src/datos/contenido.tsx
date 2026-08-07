import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type {
  BarajaLibre,
  CartaCatalogo,
  CodigoPais,
  ContenidoPais,
  Historia,
  Logro,
  MensajeSeccion,
  Nivel,
  Pais,
  Pregunta,
  Test,
} from '../tipos'

/**
 * Carga del contenido exportado desde Unity.
 *
 * Se resuelve con importación dinámica en vez de un `import` normal para que
 * el proyecto compile aunque todavía no se haya ejecutado el exportador. Si
 * falta el JSON, el error lo dice con todas las letras.
 */

const MODULOS = import.meta.glob<{ default: unknown }>('../contenido/**/*.json')

export const PAISES: readonly CodigoPais[] = ['VE', 'ES', 'EU']

/** Nombre de respaldo para los países cuyo JSON aún no se ha exportado. */
export const NOMBRE_PAIS: Record<CodigoPais, string> = {
  VE: 'Venezuela',
  ES: 'España',
  EU: 'Estados Unidos',
}

/**
 * Un país está disponible si el exportador ya escribió su carpeta. Se consulta
 * al mapa de módulos, así que no hace falta intentar la carga para saberlo.
 */
export function paisDisponible(codigo: CodigoPais): boolean {
  return `../contenido/${codigo.toLowerCase()}/pais.json` in MODULOS
}

async function cargarArchivo<T>(pais: string, nombre: string): Promise<T> {
  const clave = `../contenido/${pais}/${nombre}.json`
  const cargar = MODULOS[clave]
  if (!cargar) {
    throw new Error(
      `Falta ${clave}. Ejecuta "npm run contenido" para exportarlo desde Unity.`,
    )
  }
  const modulo = await cargar()
  return modulo.default as T
}

const cache = new Map<CodigoPais, Promise<ContenidoPais>>()

export function cargarContenido(codigo: CodigoPais): Promise<ContenidoPais> {
  const enCache = cache.get(codigo)
  if (enCache) return enCache

  const carpeta = codigo.toLowerCase()
  const promesa = Promise.all([
    cargarArchivo<Pais>(carpeta, 'pais'),
    cargarArchivo<CartaCatalogo[]>(carpeta, 'cartas'),
    cargarArchivo<Nivel[]>(carpeta, 'niveles'),
    cargarArchivo<Historia[]>(carpeta, 'historias'),
    cargarArchivo<Pregunta[]>(carpeta, 'preguntas'),
    cargarArchivo<Test[]>(carpeta, 'tests'),
    cargarArchivo<Logro[]>(carpeta, 'logros'),
    cargarArchivo<MensajeSeccion[]>(carpeta, 'secciones'),
  ]).then(
    ([pais, cartas, niveles, historias, preguntas, tests, logros, secciones]) => ({
      pais,
      cartas,
      niveles,
      historias,
      preguntas,
      tests,
      logros,
      secciones,
    }),
  )

  cache.set(codigo, promesa)
  return promesa
}

// ---------------------------------------------------------------------------
// Baraja del modo libre
// ---------------------------------------------------------------------------

export const BARAJAS: readonly BarajaLibre[] = [...PAISES, 'PL']

export const NOMBRE_BARAJA: Record<BarajaLibre, string> = {
  ...NOMBRE_PAIS,
  PL: 'Pancitolandia',
}

export function barajaDisponible(baraja: BarajaLibre): boolean {
  if (baraja === 'PL') return '../contenido/pl/cartas.json' in MODULOS
  return paisDisponible(baraja)
}

/**
 * Carga solo la baraja, sin niveles ni historias. Pancitolandia vive en su
 * propia carpeta porque no tiene el resto del contenido de un país.
 */
export function useBaraja(baraja: BarajaLibre): CartaCatalogo[] | null {
  const [cartas, setCartas] = useState<CartaCatalogo[] | null>(null)

  useEffect(() => {
    let vigente = true
    setCartas(null)

    const promesa =
      baraja === 'PL'
        ? cargarArchivo<CartaCatalogo[]>('pl', 'cartas')
        : cargarContenido(baraja).then((paquete) => paquete.cartas)

    promesa
      .then((cargadas) => {
        if (vigente) setCartas(cargadas)
      })
      .catch(() => {
        if (vigente) setCartas([])
      })

    return () => {
      vigente = false
    }
  }, [baraja])

  return cartas
}

/** Reverso de carta por tamaño de tablero, tal y como los reparte el original. */
export function useReversos(): Record<string, string> {
  const [reversos, setReversos] = useState<Record<string, string>>({})

  useEffect(() => {
    let vigente = true
    const cargar = MODULOS['../contenido/reversos.json']
    if (!cargar) return

    cargar()
      .then((modulo) => {
        if (vigente) setReversos(modulo.default as Record<string, string>)
      })
      .catch(() => undefined)

    return () => {
      vigente = false
    }
  }, [])

  return reversos
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

const Contexto = createContext<ContenidoPais | null>(null)

export function useContenido(): ContenidoPais {
  const contenido = useContext(Contexto)
  if (!contenido) {
    throw new Error('useContenido fuera de ProveedorContenido')
  }
  return contenido
}

interface Props {
  pais: CodigoPais
  cargando: ReactNode
  children: ReactNode
}

export function ProveedorContenido({ pais, cargando, children }: Props) {
  const [contenido, setContenido] = useState<ContenidoPais | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    setContenido(null)
    setError(null)

    cargarContenido(pais)
      .then((cargado) => {
        if (vigente) setContenido(cargado)
      })
      .catch((fallo: Error) => {
        if (vigente) setError(fallo.message)
      })

    return () => {
      vigente = false
    }
  }, [pais])

  if (error) return <FaltaContenido mensaje={error} />
  if (!contenido) return <>{cargando}</>
  return <Contexto.Provider value={contenido}>{children}</Contexto.Provider>
}

function FaltaContenido({ mensaje }: { mensaje: string }) {
  return (
    <div className="pantalla-error">
      <h1>Falta el contenido</h1>
      <p>{mensaje}</p>
      <pre>npm run contenido</pre>
    </div>
  )
}
