/** Ko-fi page. Override with VITE_KOFI_URL in .env / Vercel if needed. */
const DEFAULT_KOFI_URL = 'https://ko-fi.com/pancitogames'

export function getDonateUrl(): string | null {
  const url = (import.meta.env.VITE_KOFI_URL ?? DEFAULT_KOFI_URL).trim()
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
