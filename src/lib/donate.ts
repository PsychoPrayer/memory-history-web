/** Ko-fi (or any donate) page. Set VITE_KOFI_URL in .env — e.g. https://ko-fi.com/tuusuario */

export function getDonateUrl(): string | null {
  const url = (import.meta.env.VITE_KOFI_URL ?? '').trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function isDonateConfigured(): boolean {
  return getDonateUrl() !== null
}

/** Opens the donate page in a new tab. Returns false if not configured. */
export function openDonate(): boolean {
  const url = getDonateUrl()
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
