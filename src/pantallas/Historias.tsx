import { useMemo, useState } from 'react'
import { Cabecera } from '../componentes/Cabecera'
import { Modal } from '../componentes/Modal'
import { BotonLupa, VisorImagen } from '../componentes/VisorImagen'
import { useContenido } from '../datos/contenido'
import { historiasDesbloqueadas } from '../datos/progresion'
import { marcarHistoriaLeida, progresoDe, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { useIdioma, useTexto } from '../lib/i18n'
import type { Historia } from '../tipos'

export function Historias() {
  const t = useTexto()
  const idioma = useIdioma()
  const { historias, niveles } = useContenido()

  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  const abiertas = useMemo(
    () => historiasDesbloqueadas(historias, niveles, progreso),
    [historias, niveles, progreso],
  )

  const [abierta, setAbierta] = useState<Historia | null>(null)
  const [pagina, setPagina] = useState(0)
  const [ampliada, setAmpliada] = useState<string | null>(null)

  const mostrar = (historia: Historia) => {
    sonar('transicion')
    setAbierta(historia)
    setPagina(0)
    marcarHistoriaLeida(pais, historia.id)
  }

  const paginas = abierta ? abierta[idioma].texto : []

  return (
    <main className="pantalla pantalla-historias">
      <Cabecera
        titulo={t('historias')}
        derecha={
          <span className="cabecera-contador">
            {t('historiasLeidas', { a: abiertas.size, b: historias.length })}
          </span>
        }
      />

      <div className="rejilla-historias">
        {historias.map((historia) => {
          const desbloqueada = abiertas.has(historia.id)
          const nueva = desbloqueada && !progreso.historiasLeidas.includes(historia.id)

          return (
            <button
              key={historia.id}
              type="button"
              className="ficha-historia"
              data-abierta={desbloqueada}
              disabled={!desbloqueada}
              title={desbloqueada ? historia.titulo : t('historiaBloqueada')}
              onClick={() => mostrar(historia)}
            >
              {desbloqueada && historia.imagen ? (
                <img src={historia.imagen} alt="" loading="lazy" />
              ) : (
                <span className="ficha-candado" aria-hidden="true" />
              )}
              <span className="ficha-historia-nombre">
                {desbloqueada ? historia.titulo : '???'}
              </span>
              {nueva && <span className="insignia-nueva">{t('historiaNueva')}</span>}
            </button>
          )
        })}
      </div>

      <Modal abierto={abierta !== null} onCerrar={() => setAbierta(null)} ancho="ancho">
        {abierta && (
          <article className="detalle-historia">
            {abierta.imagen && (
              <div className="lamina">
                <img className="detalle-imagen" src={abierta.imagen} alt="" />
                <span className="lamina-esquinas" aria-hidden="true" />
                <BotonLupa onClick={() => setAmpliada(abierta.imagen)} />
              </div>
            )}
            <h2 className="modal-titulo">{abierta.titulo}</h2>

            <div className="detalle-texto">
              {(paginas[pagina] ?? '').split('\n\n').map((parrafo, indice) => (
                <p key={indice}>{parrafo}</p>
              ))}
            </div>

            {paginas.length > 1 && (
              <div className="paginador">
                <button
                  type="button"
                  className="boton-fantasma"
                  disabled={pagina === 0}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  {pagina + 1} / {paginas.length}
                </span>
                <button
                  type="button"
                  className="boton-fantasma"
                  disabled={pagina >= paginas.length - 1}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  →
                </button>
              </div>
            )}

            <button
              type="button"
              className="boton-principal"
              onClick={() => setAbierta(null)}
            >
              {t('cerrar')}
            </button>
          </article>
        )}
      </Modal>

      <VisorImagen
        src={ampliada}
        alt={abierta?.titulo ?? ''}
        onCerrar={() => setAmpliada(null)}
      />
    </main>
  )
}
