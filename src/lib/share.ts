/** Share a story card (image + message + game link). */

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

/** Paint a shareable card: story art + title + blurb + play URL. */
export async function buildStoryShareCard(input: {
  title: string
  text: string
  url: string
  imageUrl: string | null
}): Promise<Blob | null> {
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const paper = '#e2d6bb'
  const ink = '#2b2116'
  const gold = '#9a6f27'

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = gold
  ctx.lineWidth = 10
  ctx.strokeRect(28, 28, width - 56, height - 56)
  ctx.lineWidth = 3
  ctx.strokeRect(48, 48, width - 96, height - 96)

  const artTop = 90
  const artSize = 720
  const artLeft = (width - artSize) / 2

  ctx.fillStyle = '#f1e8d2'
  ctx.fillRect(artLeft, artTop, artSize, artSize)
  ctx.strokeStyle = ink
  ctx.lineWidth = 4
  ctx.strokeRect(artLeft, artTop, artSize, artSize)

  if (input.imageUrl) {
    try {
      const image = await loadImage(input.imageUrl)
      const scale = Math.max(artSize / image.width, artSize / image.height)
      const drawW = image.width * scale
      const drawH = image.height * scale
      ctx.save()
      ctx.beginPath()
      ctx.rect(artLeft, artTop, artSize, artSize)
      ctx.clip()
      ctx.drawImage(
        image,
        artLeft + (artSize - drawW) / 2,
        artTop + (artSize - drawH) / 2,
        drawW,
        drawH,
      )
      ctx.restore()
    } catch {
      /* keep empty plate */
    }
  }

  let y = artTop + artSize + 70
  ctx.fillStyle = ink
  ctx.font = '700 54px Georgia, serif'
  ctx.textAlign = 'center'
  for (const line of wrapLines(ctx, input.title, width - 160).slice(0, 2)) {
    ctx.fillText(line, width / 2, y)
    y += 64
  }

  y += 16
  ctx.font = 'italic 36px Georgia, serif'
  ctx.fillStyle = '#50412d'
  for (const line of wrapLines(ctx, input.text, width - 160).slice(0, 3)) {
    ctx.fillText(line, width / 2, y)
    y += 48
  }

  y = Math.max(y + 36, height - 140)
  ctx.font = '32px Georgia, serif'
  ctx.fillStyle = gold
  ctx.fillText('Memory History', width / 2, y)
  y += 44
  ctx.font = '28px Georgia, serif'
  ctx.fillStyle = ink
  ctx.fillText(input.url, width / 2, y)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
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
        text: input.text,
        url: input.url,
        imageUrl: input.imageUrl,
      })
      if (blob) {
        file = new File([blob], 'memory-history-story.png', { type: 'image/png' })
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
          title: input.title,
          text: message,
          files: [file],
        })
        return 'shared'
      }
      await navigator.share({ title: input.title, text: message, url: input.url })
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
