import bruto from './terms-es.md?raw'

/** Legal text from the original Unity project, ready to show on screen. */
export function termsText(): string {
  return bruto
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^---$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
