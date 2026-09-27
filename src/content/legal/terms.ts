import type { Language } from '../../types'
import termsEs from './terms-es.md?raw'
import termsEn from './terms-en.md?raw'

/** Bump when the terms change so returning players accept them again. */
export const TERMS_VERSION = 3

/** Legal text in the player's language, as plain text ready for the screen. */
export function termsText(language: Language = 'es'): string {
  return (language === 'en' ? termsEn : termsEs)
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^---$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
