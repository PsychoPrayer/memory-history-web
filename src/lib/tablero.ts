import type { CartaCatalogo, FichaTablero } from '../tipos'

export function barajar<T>(items: readonly T[]): T[] {
  const copia = [...items]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/**
 * Reparte el tablero.
 *
 * Igual que en Unity, el mazo del que se saca son las cartas cuyo tamaño
 * mínimo de tablero no supera al del nivel: los tableros grandes heredan todas
 * las cartas de los pequeños y añaden las suyas.
 */
export function construirTablero(
  catalogo: CartaCatalogo[],
  numeroCartas: number,
): FichaTablero[] {
  const parejas = numeroCartas / 2
  const mazo = catalogo.filter((carta) => carta.desbloqueoEn <= numeroCartas)
  const disponibles = mazo.length ? mazo : catalogo

  const elegidas = barajar(disponibles).slice(0, parejas)
  const fichas = elegidas.flatMap<FichaTablero>((carta) => [
    { clave: `${carta.id}-a`, carta, estado: 'oculta' },
    { clave: `${carta.id}-b`, carta, estado: 'oculta' },
  ])

  return barajar(fichas)
}

export function formatearTiempo(segundos: number): string {
  const seguro = Math.max(0, Math.round(segundos))
  const minutos = Math.floor(seguro / 60)
  return `${minutos}:${String(seguro % 60).padStart(2, '0')}`
}
