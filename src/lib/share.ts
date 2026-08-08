/** Share a story link on social / native share sheet. */

export function gameUrl(path = '/'): string {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).href
}

export async function shareStoryLink(input: {
  title: string
  text: string
  url: string
}): Promise<'shared' | 'copied' | 'failed'> {
  const payload = { title: input.title, text: input.text, url: input.url }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(payload)
      return 'shared'
    } catch (error) {
      if ((error as Error).name === 'AbortError') return 'failed'
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${input.text}\n${input.url}`)
      return 'copied'
    }
  } catch {
    /* fall through */
  }

  return 'failed'
}
