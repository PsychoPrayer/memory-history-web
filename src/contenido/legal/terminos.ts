import bruto from './terminos-es.md?raw'

/** Texto legal del Unity original, listo para mostrar en pantalla. */
export function textoTerminos(): string {
  return bruto
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^---$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
