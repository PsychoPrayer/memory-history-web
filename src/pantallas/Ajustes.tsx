import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cabecera } from '../componentes/Cabecera'
import { Modal } from '../componentes/Modal'
import {
  borrarProgreso,
  cambiarAjuste,
  useGuardado,
} from '../lib/almacen'
import { ajustarVolumenMusica, sonar } from '../lib/audio'
import { useTexto } from '../lib/i18n'
import type { Idioma } from '../tipos'

export function Ajustes() {
  const t = useTexto()
  const navegar = useNavigate()
  const ajustes = useGuardado((estado) => estado.ajustes)
  const [confirmando, setConfirmando] = useState(false)

  return (
    <main className="pantalla pantalla-ajustes">
      <Cabecera titulo={t('ajustes')} />

      <section className="grupo-ajuste">
        <h2>{t('idioma')}</h2>
        <div className="fila-idiomas">
          {(['es', 'en'] as Idioma[]).map((idioma) => (
            <button
              key={idioma}
              type="button"
              className="pestana"
              data-activa={ajustes.idioma === idioma}
              onClick={() => {
                sonar('boton')
                cambiarAjuste('idioma', idioma)
              }}
            >
              {idioma === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section className="grupo-ajuste">
        <h2>{t('musica')}</h2>
        <Deslizador
          valor={ajustes.volumenMusica}
          onCambio={(valor) => {
            cambiarAjuste('volumenMusica', valor)
            ajustarVolumenMusica(valor)
          }}
        />
      </section>

      <section className="grupo-ajuste">
        <h2>{t('efectos')}</h2>
        <Deslizador
          valor={ajustes.volumenEfectos}
          onCambio={(valor) => {
            cambiarAjuste('volumenEfectos', valor)
          }}
          onSoltar={() => sonar('acierto')}
        />
      </section>

      <section className="grupo-ajuste">
        <button
          type="button"
          className="boton-peligro"
          onClick={() => setConfirmando(true)}
        >
          {t('reiniciarProgreso')}
        </button>
      </section>

      <Modal abierto={confirmando} onCerrar={() => setConfirmando(false)}>
        <h2 className="modal-titulo">{t('reiniciarProgreso')}</h2>
        <p className="modal-texto">{t('confirmarBorrarProgreso')}</p>
        <div className="modal-acciones">
          <button
            type="button"
            className="boton-peligro"
            onClick={() => {
              borrarProgreso(ajustes.pais)
              setConfirmando(false)
              navegar('/menu')
            }}
          >
            {t('si')}
          </button>
          <button
            type="button"
            className="boton-secundario"
            onClick={() => setConfirmando(false)}
          >
            {t('no')}
          </button>
        </div>
      </Modal>
    </main>
  )
}

interface DeslizadorProps {
  valor: number
  onCambio: (valor: number) => void
  onSoltar?: () => void
}

function Deslizador({ valor, onCambio, onSoltar }: DeslizadorProps) {
  return (
    <div className="deslizador">
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(valor * 100)}
        onChange={(evento) => onCambio(Number(evento.target.value) / 100)}
        onPointerUp={onSoltar}
      />
      <span>{Math.round(valor * 100)}%</span>
    </div>
  )
}
