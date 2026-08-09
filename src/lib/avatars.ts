import plCards from '../content/pl/cards.json'
import type { CardCatalog } from '../types'

export interface AvatarOption {
  id: string
  name: string
  image: string
}

const cards = plCards as CardCatalog[]

const GUIDE_AVATARS: AvatarOption[] = [
  { id: 'ui:happy', name: 'Pancito', image: '/imagenes/ui/pancito/happy.webp' },
  { id: 'ui:guide', name: 'Pancito guía', image: '/imagenes/ui/pancito/guide.webp' },
  { id: 'ui:point', name: 'Pancito señal', image: '/imagenes/ui/pancito/point.webp' },
  { id: 'ui:wait', name: 'Pancito espera', image: '/imagenes/ui/pancito/wait.webp' },
  {
    id: 'ui:defeated',
    name: 'Pancito molido',
    image: '/imagenes/ui/pancito/defeated.webp',
  },
]

/** PancitoLandia card faces + classic guide poses (until more art arrives). */
export function listAvatarOptions(): AvatarOption[] {
  const fromDeck = cards
    .filter((card) => Boolean(card.imagen))
    .map((card) => ({
      id: `pl:${card.id}`,
      name: card.nombre,
      image: card.imagen as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return [...GUIDE_AVATARS, ...fromDeck]
}

export const DEFAULT_AVATAR_ID = 'ui:happy'

export function avatarById(id: string | null | undefined): AvatarOption {
  const options = listAvatarOptions()
  return options.find((option) => option.id === id) ?? options[0]!
}

export function isValidPlayerName(raw: string): boolean {
  const name = raw.trim()
  return name.length >= 2 && name.length <= 16
}
