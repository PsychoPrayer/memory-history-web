import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cabecera } from '../componentes/Cabecera'
import { Estrellas } from '../componentes/Estrellas'
import { useContenido } from '../datos/contenido'
import { estaDesbloqueado, estrellasDe, seccionesDe } from '../datos/progresion'
import { progresoDe, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { useTexto, type ClaveTexto } from '../lib/i18n'
import type { Nivel } from '../tipos'

/**
 * El original no numeraba las secciones: cada tamaño de tablero tenía nombre
 * de grado, de Aprendiz a Erudito. Los textos están en i18n.
 */
function claveDeSeccion(cartas: number): ClaveTexto {
  return `seccion${cartas}` as ClaveTexto
}

export function Niveles() {
  const t = useTexto()
  const { niveles } = useContenido()
  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  const secciones = useMemo(() => seccionesDe(niveles), [niveles])

  // Arranca en la primera sección que aún tenga algo pendiente.
  const inicial = useMemo(() => {
    const pendiente = secciones.find((seccion) =>
      [...seccion.normales, ...seccion.dificiles].some(
        (nivel) => estrellasDe(progreso, nivel.id) === 0,
      ),
    )
    return pendiente?.cartas ?? secciones[0]?.cartas ?? 12
  }, [secciones, progreso])

  const [activa, setActiva] = useState(inicial)
  const seccion = secciones.find((s) => s.cartas === activa) ?? secciones[0]

  if (!seccion) return null

  return (
    <main className="pantalla pantalla-niveles">
      <Cabecera titulo={t('niveles')} />

      <nav className="pestanas-secciones">
        {secciones.map((otra) => (
          <button
            key={otra.cartas}
            type="button"
            className="pestana"
            data-activa={otra.cartas === activa}
            onClick={() => {
              sonar('transicion')
              setActiva(otra.cartas)
            }}
          >
            {t(claveDeSeccion(otra.cartas))}
          </button>
        ))}
      </nav>

      <p className="seccion-rotulo">
        {t('rotuloSeccion', {
          nombre: t(claveDeSeccion(seccion.cartas)),
          n: seccion.cartas,
        })}
      </p>

      <GrupoDeNiveles
        titulo={t('normales')}
        niveles={seccion.normales}
        todos={niveles}
      />
      <GrupoDeNiveles
        titulo={t('dificiles')}
        niveles={seccion.dificiles}
        todos={niveles}
      />
    </main>
  )
}

interface GrupoProps {
  titulo: string
  niveles: Nivel[]
  todos: Nivel[]
}

function GrupoDeNiveles({ titulo, niveles, todos }: GrupoProps) {
  const navegar = useNavigate()
  const t = useTexto()
  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  return (
    <section className="grupo-niveles">
      <div className="grupo-cabecera">
        <h2>{titulo}</h2>
      </div>

      <div className="rejilla-niveles">
        {niveles.map((nivel, indice) => {
          const abierto = estaDesbloqueado(nivel, todos, progreso)
          const estrellas = estrellasDe(progreso, nivel.id)

          return (
            <button
              key={nivel.id}
              type="button"
              className="ficha-nivel"
              data-abierto={abierto}
              disabled={!abierto}
              title={abierto ? nivel.nombre : t('completaAnterior')}
              onClick={() => {
                sonar('transicion')
                navegar(`/juego/${encodeURIComponent(nivel.id)}`)
              }}
            >
              <span className="ficha-numero">{indice + 1}</span>
              {abierto ? (
                <Estrellas cantidad={estrellas} tamano="pip" />
              ) : (
                <span className="ficha-candado" aria-label={t('bloqueado')} />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
