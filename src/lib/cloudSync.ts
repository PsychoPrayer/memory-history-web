import type { Session, User } from '@supabase/supabase-js'
import { mergeSavedStates } from './mergeSave'
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

function schedulePush(state: SavedState) {
  if (!user) return
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

async function pullAndMerge(session: Session) {
  setStatus('syncing', session.user)
  try {
    const remote = await fetchRemote(session.user.id)
    const local = readState()
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
        if (event !== 'TOKEN_REFRESHED') void pullAndMerge(session)
        else setStatus('synced', session.user)
      } else {
        setStatus('synced', session.user)
      }
    } else {
      if (pushTimer) clearTimeout(pushTimer)
      setStatus(isSupabaseConfigured() ? 'signedOut' : 'disabled', null)
    }
  })

  return () => {
    subscription.unsubscribe()
    registerSync(null)
    if (pushTimer) clearTimeout(pushTimer)
  }
}

export async function signUp(email: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const supabase = getSupabase()
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
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
