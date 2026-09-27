import plCards from '../content/pl/cards.json'
import type { CardCatalog } from '../types'

export interface AvatarOption {
  id: string
  name: string
  image: string
  /** 0 for the free guide poses; n = the n-th prize avatar (1-based). */
  prize: number
}

const cards = plCards as CardCatalog[]

const GUIDE_AVATARS: AvatarOption[] = [
  { id: 'ui:happy', name: 'Pancito', image: '/imagenes/ui/pancito/happy.webp', prize: 0 },
  { id: 'ui:guide', name: 'Pancito guía', image: '/imagenes/ui/pancito/guide.webp', prize: 0 },
  { id: 'ui:point', name: 'Pancito señal', image: '/imagenes/ui/pancito/point.webp', prize: 0 },
  { id: 'ui:wait', name: 'Pancito espera', image: '/imagenes/ui/pancito/wait.webp', prize: 0 },
  {
    id: 'ui:defeated',
    name: 'Pancito molido',
    image: '/imagenes/ui/pancito/defeated.webp',
    prize: 0,
  },
]

/** PancitoLandia card faces are prizes, earned in order through the daily challenge. */
const PRIZE_AVATARS: AvatarOption[] = cards
  .filter((card) => Boolean(card.imagen))
  .map((card) => ({
    id: `pl:${card.id}`,
    name: card.nombre,
    image: card.imagen as string,
    prize: 0,
  }))
  .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
  .map((option, index) => ({ ...option, prize: index + 1 }))

const ALL_AVATARS = [...GUIDE_AVATARS, ...PRIZE_AVATARS]

export const PRIZE_AVATAR_TOTAL = PRIZE_AVATARS.length

export function listAvatarOptions(): AvatarOption[] {
  return ALL_AVATARS
}

export function isAvatarUnlocked(option: AvatarOption, prizesEarned: number): boolean {
  return option.prize === 0 || option.prize <= prizesEarned
}

/** Prize avatars that become available when the earned count grows. */
export function avatarsUnlockedBetween(before: number, after: number): AvatarOption[] {
  return PRIZE_AVATARS.filter((option) => option.prize > before && option.prize <= after)
}

export const DEFAULT_AVATAR_ID = 'ui:happy'

export function avatarById(id: string | null | undefined): AvatarOption {
  return ALL_AVATARS.find((option) => option.id === id) ?? ALL_AVATARS[0]!
}

export function isValidPlayerName(raw: string): boolean {
  const name = raw.trim()
  return name.length >= 2 && name.length <= 16
}
