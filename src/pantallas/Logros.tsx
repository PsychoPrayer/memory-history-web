import { useMemo, useState } from 'react'
import { Cabecera } from '../componentes/Cabecera'
import { Modal } from '../componentes/Modal'
import { useContenido } from '../datos/contenido'
import { progresoDeLogro, resumirJugador } from '../datos/progresion'
import { progresoDe, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { useIdioma, useTexto } from '../lib/i18n'
import type { Logro } from '../tipos'

export function Logros() {
  const t = useTexto()
  const idioma = useIdioma()
  const { logros, niveles, historias } = useContenido()

  const pais = useGuardado((estado) => estado.ajustes.pais)
  const progreso = useGuardado(() => progresoDe(pais))

  const resumen = useMemo(
    () => resumirJugador(niveles, historias, progreso),
    [historias, niveles, progreso],
  )

  const [abierto, setAbierto] = useState<Logro | null>(null)

  const conseguidos = logros.filter(
    (logro) => progresoDeLogro(logro, resumen) >= logro.objetivo,
  ).length

  return (
    <main className="pantalla pantalla-logros">
      <Cabecera
        titulo={t('logros')}
        derecha={
          <span className="cabecera-contador">
            {conseguidos}/{logros.length}
          </span>
        }
      />

      <div className="rejilla-logros">
        {logros.map((logro) => {
          const avance = Math.min(progresoDeLogro(logro, resumen), logro.objetivo)
          const conseguido = avance >= logro.objetivo

          return (
            <button
              key={logro.id}
              type="button"
              className="ficha-logro"
              data-conseguido={conseguido}
              onClick={() => {
                sonar('transicion')
                setAbierto(logro)
              }}
            >
              {logro.icono ? (
                <img src={logro.icono} alt="" loading="lazy" />
              ) : (
                <span className="ficha-logro-inicial">
                  {logro[idioma].titulo.slice(0, 1)}
                </span>
              )}
              <span className="ficha-logro-nombre">{logro[idioma].titulo}</span>
              {logro.conProgreso && !conseguido && (
                <span className="barra-progreso">
                  <span style={{ width: `${(avance / logro.objetivo) * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Modal abierto={abierto !== null} onCerrar={() => setAbierto(null)}>
        {abierto && (
          <>
            <h2 className="modal-titulo">{abierto[idioma].titulo}</h2>
            <p className="modal-texto">{abierto[idioma].descripcion}</p>
            <p className="modal-texto modal-texto-tenue">
              {t('progresoLogro', {
                a: Math.min(progresoDeLogro(abierto, resumen), abierto.objetivo),
                b: abierto.objetivo,
              })}
            </p>
            <button
              type="button"
              className="boton-principal"
              onClick={() => setAbierto(null)}
            >
              {t('cerrar')}
            </button>
          </>
        )}
      </Modal>
    </main>
  )
}
