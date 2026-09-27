import type { Session, User } from '@supabase/supabase-js'
import { mergeSavedStates } from './mergeSave'
import { hasProgress, sameSummary, summarizeSave } from './saveSummary'
import { getSupabase, isSupabaseConfigured } from './supabase'
import {
  hydrateState,
  readState,
  registerSync,
  type SavedState,
} from './save'

export type CloudStatus =
  | 'disabled'
  | 'signedOut'
  | 'syncing'
  | 'synced'
  | 'error'

type StatusListener = (status: CloudStatus, user: User | null, error?: string) => void

let status: CloudStatus = isSupabaseConfigured() ? 'signedOut' : 'disabled'
let user: User | null = null
let lastError: string | undefined
let pushTimer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<StatusListener>()

function setStatus(next: CloudStatus, nextUser: User | null = user, error?: string) {
  status = next
  user = nextUser
  lastError = error
  for (const listener of listeners) listener(status, user, lastError)
}

export function getCloudStatus() {
  return { status, user, error: lastError }
}

export function subscribeCloud(listener: StatusListener) {
  listeners.add(listener)
  listener(status, user, lastError)
  return () => {
    listeners.delete(listener)
  }
}

async function fetchRemote(userId: string): Promise<SavedState | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('saves')
    .select('state, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data?.state) return null
  const remote = data.state as SavedState
  if (!remote.updatedAt && data.updated_at) {
    remote.updatedAt = new Date(data.updated_at).getTime()
  }
  return remote
}

async function pushRemote(userId: string, state: SavedState) {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.from('saves').upsert(
    {
      user_id: userId,
      state,
      updated_at: new Date(state.updatedAt ?? Date.now()).toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}

/**
 * Signing in on a device whose progress differs from the account's: the player
 * picks what to keep. Until then nothing is pushed, so neither side is lost.
 */
export interface SyncConflict {
  local: SavedState
  remote: SavedState
  accountName: string
}

/** account = load the cloud save here; merge = best of both; device = upload this device's. */
export type SyncChoice = 'account' | 'merge' | 'device'

let conflict: SyncConflict | null = null
const conflictListeners = new Set<(value: SyncConflict | null) => void>()
/** Set by an explicit sign-in so a background session refresh never prompts. */
let askOnNextSignIn = false

function setConflict(next: SyncConflict | null) {
  conflict = next
  for (const listener of conflictListeners) listener(conflict)
}

export function subscribeConflict(listener: (value: SyncConflict | null) => void) {
  conflictListeners.add(listener)
  listener(conflict)
  return () => {
    conflictListeners.delete(listener)
  }
}

/** Keep onboarding done on this device even when adopting the account's save. */
function adoptAccount(local: SavedState, remote: SavedState): SavedState {
  const a = local.settings
  const b = remote.settings
  return {
    ...remote,
    updatedAt: Date.now(),
    settings: {
      ...b,
      termsAccepted: a.termsAccepted || b.termsAccepted,
      termsVersion: Math.max(a.termsVersion ?? 0, b.termsVersion ?? 0),
      languageChosen: a.languageChosen || b.languageChosen,
      pancitoMet: a.pancitoMet || b.pancitoMet,
      guideSeen: a.guideSeen || b.guideSeen,
      profileSetupDone: a.profileSetupDone || b.profileSetupDone,
      tipsSeen: [...new Set([...(a.tipsSeen ?? []), ...(b.tipsSeen ?? [])])],
    },
  }
}

export async function resolveConflict(choice: SyncChoice) {
  const pending = conflict
  if (!pending || !user) return
  const next =
    choice === 'account'
      ? adoptAccount(pending.local, pending.remote)
      : choice === 'device'
        ? { ...readState(), updatedAt: Date.now() }
        : mergeSavedStates(readState(), pending.remote)

  setStatus('syncing', user)
  try {
    hydrateState(next, { syncCloud: false })
    await pushRemote(user.id, next)
    setConflict(null)
    setStatus('synced', user)
  } catch (error) {
    setStatus('error', user, error instanceof Error ? error.message : 'Cloud sync failed')
  }
}

function schedulePush(state: SavedState) {
  if (!user || conflict) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void (async () => {
      if (!user) return
      try {
        setStatus('syncing', user)
        await pushRemote(user.id, state)
        setStatus('synced', user)
      } catch (error) {
        setStatus(
          'error',
          user,
          error instanceof Error ? error.message : 'Cloud sync failed',
        )
      }
    })()
  }, 800)
}

async function pullAndMerge(session: Session, ask = false) {
  setStatus('syncing', session.user)
  try {
    const remote = await fetchRemote(session.user.id)
    const local = readState()
    if (remote && ask) {
      const mine = summarizeSave(local)
      const theirs = summarizeSave(remote)
      if (hasProgress(mine) && hasProgress(theirs) && !sameSummary(mine, theirs)) {
        setConflict({ local, remote, accountName: accountLabel(session.user) })
        setStatus('synced', session.user)
        return
      }
    }
    if (remote) {
      const merged = mergeSavedStates(local, remote)
      hydrateState(merged, { syncCloud: false })
      await pushRemote(session.user.id, merged)
    } else {
      await pushRemote(session.user.id, local)
    }
    setStatus('synced', session.user)
  } catch (error) {
    setStatus(
      'error',
      session.user,
      error instanceof Error ? error.message : 'Cloud sync failed',
    )
  }
}

/** Call once from App. No-ops when env vars are missing. */
export function initCloudSync() {
  const supabase = getSupabase()
  if (!supabase) {
    setStatus('disabled', null)
    return () => undefined
  }

  registerSync((state) => schedulePush(state))

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      user = session.user
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        if (event !== 'TOKEN_REFRESHED') {
          const ask = event === 'SIGNED_IN' && askOnNextSignIn
          askOnNextSignIn = false
          void pullAndMerge(session, ask)
        } else setStatus('synced', session.user)
      } else {
        setStatus('synced', session.user)
      }
    } else {
      if (pushTimer) clearTimeout(pushTimer)
      setConflict(null)
      setStatus(isSupabaseConfigured() ? 'signedOut' : 'disabled', null)
    }
  })

  return () => {
    subscription.unsubscribe()
    registerSync(null)
    if (pushTimer) clearTimeout(pushTimer)
  }
}

/**
 * Supabase Auth needs an email, but players only pick a username. We map each
 * username to an internal address that never receives mail, so
 * "Confirm email" must stay disabled in the Supabase dashboard.
 */
const USERNAME_EMAIL_DOMAIN =
  (import.meta.env.VITE_USERNAME_EMAIL_DOMAIN as string | undefined)?.trim() ||
  'users.memoryhistory.app'

export const USERNAME_PATTERN = /^[a-z0-9_]{3,16}$/

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

function usernameToEmail(username: string): string {
  return `${username}@${USERNAME_EMAIL_DOMAIN}`
}

/** Name to show for the signed-in player (legacy email accounts show their email). */
export function accountLabel(account: User | null): string {
  if (!account) return ''
  const fromMeta = account.user_metadata?.username
  if (typeof fromMeta === 'string' && fromMeta) return fromMeta
  const email = account.email ?? ''
  const suffix = `@${USERNAME_EMAIL_DOMAIN}`
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email
}

export async function signUp(rawUsername: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')
  const username = normalizeUsername(rawUsername)
  if (!USERNAME_PATTERN.test(username)) throw new Error('invalid_username')
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username } },
  })
  if (error) throw error
  return data
}

/** Accepts a username, or an email for accounts created before usernames. */
export async function signIn(login: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')
  const trimmed = login.trim()
  const email = trimmed.includes('@')
    ? trimmed
    : usernameToEmail(normalizeUsername(trimmed))
  askOnNextSignIn = true
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) {
    askOnNextSignIn = false
    throw error
  }
  return data
}

export async function signOut() {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function syncNow() {
  const supabase = getSupabase()
  if (!supabase || !user) return
  const { data } = await supabase.auth.getSession()
  if (data.session) await pullAndMerge(data.session)
}
