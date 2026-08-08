import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

interface Props {
  title: string
  backTo?: string
  right?: ReactNode
}

export function Header({ title, backTo = '/menu', right }: Props) {
  const navigate = useNavigate()
  const t = useT()

  return (
    <header className="header">
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          playSound('transition')
          navigate(backTo)
        }}
        aria-label={t('back')}
      >
        ←
      </button>
      <h1 className="header-title">{title}</h1>
      <div className="header-right">{right}</div>
    </header>
  )
}
