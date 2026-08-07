import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../componentes/Modal'
import { PUNTA_ESTRELLA } from '../componentes/Estrellas'
import {
  NOMBRE_PAIS,
  PAISES,
  paisDisponible,
  useContenido,
} from '../datos/contenido'
import {
  historiasDesbloqueadas,
  totalEstrellas,
} from '../datos/progresion'
import { textoTerminos } from '../contenido/legal/terminos'
import { cambiarAjuste, progresoDe, useGuardado } from '../lib/almacen'
import { sonar } from '../lib/audio'
import { useTexto } from '../lib/i18n'
import type { CodigoPais, Idioma } from '../tipos'

export function Menu() {
  const navegar = useNavigate()
  const t = useTexto()
  const { niveles, historias, pais } = useContenido()

  const ajustes = useGuardado((estado) => estado.ajustes)
  const progreso = useGuardado(() => progresoDe(ajustes.pais))

  const [creditos, setCreditos] = useState(false)
  const [eligiendoPais, setEligiendoPais] = useState(false)

  const estrellas = totalEstrellas(progreso)
  const maximo = niveles.length * 3
  const abiertas = historiasDesbloqueadas(historias, niveles, progreso).size

  const ir = (ruta: string) => {
    sonar('transicion')
    navegar(ruta)
  }

  return (
    <main className="pantalla pantalla-menu">
      <header className="menu-cabecera">
        <div className="selector-pais">
          <p className="selector-pais-etiqueta">{t('paises')}</p>
          <button
            type="button"
            className="pais-actual"
            onClick={() => {
              sonar('transicion')
              setEligiendoPais(true)
            }}
          >
            {pais.bandera && (
              <img
                className="pais-bandera-grande"
                src={pais.bandera}
                alt=""
                draggable={false}
              />
            )}
            <span className="pais-actual-nombre">
              {ajustes.idioma === 'es' ? pais.es : pais.en}
            </span>
          </button>
        </div>
        <h1 className="menu-titulo">Memory History</h1>
        <div className="contador-estrellas">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={PUNTA_ESTRELLA} />
          </svg>
          <span>{t('estrellasDe', { a: estrellas, b: maximo })}</span>
        </div>
      </header>

      <nav className="menu-botones">
        <button type="button" className="boton-principal" onClick={() => ir('/niveles')}>
          {t('jugar')}
        </button>
        <button type="button" className="boton-secundario" onClick={() => ir('/historias')}>
          {t('historias')}
          <span className="boton-nota">{abiertas}/{historias.length}</span>
        </button>
        <button type="button" className="boton-secundario" onClick={() => ir('/tests')}>
          {t('tests')}
        </button>
        <button type="button" className="boton-secundario" onClick={() => ir('/logros')}>
          {t('logros')}
        </button>
        <button type="button" className="boton-secundario" onClick={() => ir('/libre')}>
          {t('libre')}
        </button>
        <button type="button" className="boton-secundario" onClick={() => ir('/ajustes')}>
          {t('ajustes')}
        </button>
      </nav>

      <footer className="menu-pie">
        <button
          type="button"
          className="enlace-discreto"
          onClick={() => setCreditos(true)}
        >
          {t('creditos')}
        </button>
      </footer>

      <Bienvenida />

      <Modal abierto={eligiendoPais} onCerrar={() => setEligiendoPais(false)}>
        <h2 className="modal-titulo">{t('eligePais')}</h2>
        <SelectorDePais
          actual={ajustes.pais}
          onElegir={(codigo) => {
            sonar('boton')
            cambiarAjuste('pais', codigo)
            setEligiendoPais(false)
          }}
        />
        <button
          type="button"
          className="boton-secundario"
          onClick={() => setEligiendoPais(false)}
        >
          {t('cerrar')}
        </button>
      </Modal>

      <Modal abierto={creditos} onCerrar={() => setCreditos(false)}>
        <h2 className="modal-titulo">{t('creditos')}</h2>
        <p className="modal-texto">
          Un juego de PancitoGames sobre la cultura y la historia de{' '}
          {ajustes.idioma === 'es' ? pais.es : pais.en}.
        </p>
        <p className="modal-texto modal-texto-tenue">
          Ilustraciones, textos y diseño originales del proyecto en Unity,
          reconstruido para la web.
        </p>
        <button
          type="button"
          className="boton-principal"
          onClick={() => setCreditos(false)}
        >
          {t('cerrar')}
        </button>
      </Modal>
    </main>
  )
}

interface SelectorProps {
  actual: CodigoPais
  onElegir: (codigo: CodigoPais) => void
}

function SelectorDePais({ actual, onElegir }: SelectorProps) {
  const t = useTexto()

  return (
    <div className="lista-paises">
      {PAISES.map((codigo) => {
        const listo = paisDisponible(codigo)
        const bandera = `/imagenes/banderas/${codigo.toLowerCase()}.webp`
        return (
          <button
            key={codigo}
            type="button"
            className="ficha-pais"
            data-activo={codigo === actual}
            disabled={!listo}
            onClick={() => onElegir(codigo)}
          >
            <img
              className="pais-bandera pais-bandera-lista"
              src={bandera}
              alt=""
              draggable={false}
            />
            <span className="ficha-pais-nombre">{NOMBRE_PAIS[codigo]}</span>
            {!listo && (
              <span className="ficha-pais-detalle">{t('paisSinExportar')}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Tres pasos y listo: idioma → una hoja de cómo se juega → términos.
 * Nada de tutoriales de ocho pantallas.
 */
function Bienvenida() {
  const t = useTexto()
  const ajustes = useGuardado((estado) => estado.ajustes)
  const [aceptados, setAceptados] = useState(false)

  if (!ajustes.idiomaElegido) {
    return (
      <Modal abierto>
        <h2 className="modal-titulo">{t('eligeIdioma')}</h2>
        <div className="fila-idiomas">
          {(['es', 'en'] as Idioma[]).map((idioma) => (
            <button
              key={idioma}
              type="button"
              className="boton-secundario"
              onClick={() => {
                sonar('boton')
                cambiarAjuste('idioma', idioma)
                cambiarAjuste('idiomaElegido', true)
              }}
            >
              {idioma === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
      </Modal>
    )
  }

  if (!ajustes.guiaVista) {
    return (
      <Modal abierto>
        <h2 className="modal-titulo">{t('comoSeJuega')}</h2>
        <ol className="guia-pasos">
          <li>{t('guiaPaso1')}</li>
          <li>{t('guiaPaso2')}</li>
          <li>{t('guiaPaso3')}</li>
        </ol>
        <p className="modal-texto-tenue">{t('guiaPie')}</p>
        <button
          type="button"
          className="boton-principal"
          onClick={() => {
            sonar('boton')
            cambiarAjuste('guiaVista', true)
          }}
        >
          {t('continuar')}
        </button>
      </Modal>
    )
  }

  if (!ajustes.terminosAceptados) {
    return (
      <Modal abierto ancho="ancho">
        <h2 className="modal-titulo">{t('terminosTitulo')}</h2>
        <p className="modal-texto-tenue">{t('terminosAyuda')}</p>
        <div className="cuerpo-terminos" tabIndex={0}>
          {textoTerminos()}
        </div>
        <label className="casilla">
          <input
            type="checkbox"
            checked={aceptados}
            onChange={(evento) => setAceptados(evento.target.checked)}
          />
          <span>{t('terminos')}</span>
        </label>
        <button
          type="button"
          className="boton-principal"
          disabled={!aceptados}
          onClick={() => {
            sonar('boton')
            cambiarAjuste('terminosAceptados', true)
          }}
        >
          {t('empezarAExplorar')}
        </button>
      </Modal>
    )
  }

  return null
}
