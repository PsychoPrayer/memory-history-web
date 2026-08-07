import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTexto } from '../lib/i18n'

/** Mismo orden que Unity: PancitoGames → Memory History. Mínimo 2 s cada uno. */
const PASOS = [
  {
    imagen: '/imagenes/intro/pancito-games.webp',
    alt: 'PancitoGames',
    ms: 2500,
  },
  {
    imagen: '/imagenes/intro/memory-history.webp',
    alt: 'Memory History',
    ms: 2500,
  },
] as const

export function Intro() {
  const navegar = useNavigate()
  const t = useTexto()
  const [paso, setPaso] = useState(0)

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (paso + 1 < PASOS.length) setPaso(paso + 1)
      else navegar('/menu', { replace: true })
    }, PASOS[paso].ms)
    return () => clearTimeout(id)
  }, [navegar, paso])

  useEffect(() => {
    const saltar = (evento: KeyboardEvent) => {
      if (evento.key === ' ' || evento.key === 'Escape' || evento.key === 'Enter') {
        navegar('/menu', { replace: true })
      }
    }
    window.addEventListener('keydown', saltar)
    return () => window.removeEventListener('keydown', saltar)
  }, [navegar])

  const actual = PASOS[paso]

  return (
    <main
      className="pantalla-intro"
      onClick={() => navegar('/menu', { replace: true })}
    >
      <div className="intro-logo" key={paso}>
        <img
          className="intro-imagen"
          src={actual.imagen}
          alt={actual.alt}
          draggable={false}
        />
      </div>
      <button type="button" className="intro-saltar">
        {t('saltar')}
      </button>
    </main>
  )
}
