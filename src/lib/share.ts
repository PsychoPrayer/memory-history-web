/** Share a story card (story art + title + brand). Link travels in the share text. */

export function gameUrl(path = '/'): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load ${src}`))
    image.src = src
  })
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Shareable card: story image at natural aspect (no square crop),
 * title underneath, Memory History brand. No URL on the image.
 */
export async function buildStoryShareCard(input: {
  title: string
  imageUrl: string | null
}): Promise<Blob | null> {
  const width = 1080
  const sidePad = 72
  const topPad = 72
  const maxArtWidth = width - sidePad * 2
  const maxArtHeight = 980
  const paper = '#e2d6bb'
  const ink = '#2b2116'
  const gold = '#9a6f27'

  let artW = maxArtWidth
  let artH = Math.round(maxArtWidth * 0.75)
  let image: HTMLImageElement | null = null

  if (input.imageUrl) {
    try {
      image = await loadImage(input.imageUrl)
      const scale = Math.min(maxArtWidth / image.width, maxArtHeight / image.height, 1)
      artW = Math.round(image.width * scale)
      artH = Math.round(image.height * scale)
    } catch {
      image = null
    }
  }

  const titleBlock = 160
  const brandBlock = 90
  const height = topPad + artH + 48 + titleBlock + brandBlock + 48

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)

  const artLeft = Math.round((width - artW) / 2)
  const artTop = topPad

  if (image) {
    ctx.drawImage(image, artLeft, artTop, artW, artH)
  } else {
    ctx.fillStyle = '#f1e8d2'
    ctx.fillRect(artLeft, artTop, artW, artH)
  }

  let y = artTop + artH + 64
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.font = '700 52px Georgia, "Times New Roman", serif'
  for (const line of wrapLines(ctx, input.title, width - sidePad * 2).slice(0, 3)) {
    ctx.fillText(line, width / 2, y)
    y += 60
  }

  y = height - 56
  ctx.font = '400 34px Georgia, "Times New Roman", serif'
  ctx.fillStyle = gold
  ctx.fillText('Memory History', width / 2, y)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
}

export function duelInviteUrl(code: string): string {
  const clean = code.trim().toUpperCase()
  return gameUrl(`/duel?code=${encodeURIComponent(clean)}`)
}

export async function shareDuelInvite(input: {
  code: string
  text: string
}): Promise<'shared' | 'copied' | 'failed'> {
  const url = duelInviteUrl(input.code)
  const message = `${input.text}\n${url}`

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: 'Memory History',
        text: input.text,
        url,
      })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'failed'
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message)
      return 'copied'
    }
  } catch {
    /* fall through */
  }

  return 'failed'
}

export async function shareStoryLink(input: {
  title: string
  text: string
  url: string
  imageUrl?: string | null
}): Promise<'shared' | 'copied' | 'failed'> {
  const message = `${input.text}\n${input.url}`
  let file: File | null = null

  if (input.imageUrl) {
    try {
      const blob = await buildStoryShareCard({
        title: input.title,
        imageUrl: input.imageUrl,
      })
      if (blob) {
        file = new File([blob], 'Memory-History.png', { type: 'image/png' })
      }
    } catch {
      file = null
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      if (
        file &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: 'Memory History',
          text: message,
          files: [file],
        })
        return 'shared'
      }
      await navigator.share({ title: 'Memory History', text: message, url: input.url })
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'failed'
    }
  }

  try {
    if (file && 'ClipboardItem' in window && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': file,
          'text/plain': new Blob([message], { type: 'text/plain' }),
        }),
      ])
      return 'copied'
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(message)
      return 'copied'
    }
  } catch {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message)
        return 'copied'
      }
    } catch {
      /* fall through */
    }
  }

  return 'failed'
}
