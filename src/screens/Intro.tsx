import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

const STEPS = [
  {
    image: '/imagenes/intro/pancito-games.webp',
    alt: 'PancitoGames',
    ms: 2500,
  },
  {
    image: '/imagenes/intro/memory-history.webp',
    alt: 'Memory History',
    ms: 2500,
  },
] as const

export function Intro() {
  const navigate = useNavigate()
  const t = useT()
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (step + 1 < STEPS.length) setStep(step + 1)
      else navigate('/menu', { replace: true })
    }, STEPS[step].ms)
    return () => clearTimeout(id)
  }, [navigate, step])

  useEffect(() => {
    const skip = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Escape' || event.key === 'Enter') {
        navigate('/menu', { replace: true })
      }
    }
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [navigate])

  const current = STEPS[step]

  return (
    <main id="main-content" className="screen-intro" tabIndex={-1} onClick={() => navigate('/menu', { replace: true })}>
      <div className="intro-logo" key={step}>
        <img
          className="intro-image"
          src={current.image}
          alt={current.alt}
          draggable={false}
        />
      </div>
      <button type="button" className="intro-skip">
        {t('skip')}
      </button>
    </main>
  )
}