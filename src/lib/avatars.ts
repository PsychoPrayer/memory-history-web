export interface AvatarOption {
  id: string
  name: string
  image: string
}

/** The five Pancitos the player can wear. */
const AVATARS: AvatarOption[] = [
  { id: 'ui:happy', name: 'Pancito', image: '/imagenes/ui/pancito/happy.webp' },
  { id: 'ui:guide', name: 'Pancito guía', image: '/imagenes/ui/pancito/guide.webp' },
  { id: 'ui:point', name: 'Pancito señal', image: '/imagenes/ui/pancito/point.webp' },
  { id: 'ui:wait', name: 'Pancito espera', image: '/imagenes/ui/pancito/wait.webp' },
  { id: 'ui:defeated', name: 'Pancito molido', image: '/imagenes/ui/pancito/defeated.webp' },
]

export function listAvatarOptions(): AvatarOption[] {
  return AVATARS
}

export const DEFAULT_AVATAR_ID = 'ui:happy'

/** Unknown ids (like the old daily-challenge prizes) fall back to the first Pancito. */
export function avatarById(id: string | null | undefined): AvatarOption {
  return AVATARS.find((option) => option.id === id) ?? AVATARS[0]!
}

export function isValidPlayerName(raw: string): boolean {
  const name = raw.trim()
  return name.length >= 2 && name.length <= 16
}
