/**
 * Blocks offensive names before they reach other players. Kept in sync with
 * public.name_is_blocked() in supabase/accounts.sql, which enforces the same
 * list on the server for the leaderboard.
 */
const BLOCKED =
  /(mierd|pendej|cabron|verga|gilipoll|maricon|malparid|hijueput|hijodeput|culiao|mamaguev|mamahuev|coño|putit|puto|(?<!re)puta($|[^d])|zorra|follar|fuck|shit|bitch|cunt|nigg|fagg|whore|slut|retard|nazi|hitler|porn|pussy)/

const SWAPS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
}

export function isNameBlocked(name: string): boolean {
  const normalized = name
    .toLowerCase()
    .replace(/[013457@$]/g, (char) => SWAPS[char] ?? char)
    .replace(/[^a-zñ]/g, '')
  return BLOCKED.test(normalized)
}
