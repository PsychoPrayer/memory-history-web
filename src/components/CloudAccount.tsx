import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SummaryList } from './SyncChoice'
import { hasProgress, summarizeSave } from '../lib/saveSummary'
import { useSave } from '../lib/save'
import {
  accountLabel,
  getCloudStatus,
  signIn,
  signOut,
  signUp,
  subscribeCloud,
  syncNow,
  type CloudStatus,
} from '../lib/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import type { User } from '@supabase/supabase-js'

function statusLabel(status: CloudStatus, t: ReturnType<typeof useT>): string {
  switch (status) {
    case 'disabled':
      return t('cloudDisabled')
    case 'signedOut':
      return t('cloudSignedOut')
    case 'syncing':
      return t('cloudSyncing')
    case 'synced':
      return t('cloudSynced')
    case 'error':
      return t('cloudError')
  }
}

function authErrorMessage(err: unknown, t: ReturnType<typeof useT>): string {
  const message = err instanceof Error ? err.message : ''
  const code = (err as { code?: string } | null)?.code
  if (message === 'invalid_username') return t('cloudUsernameRules')
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return t('cloudUsernameTaken')
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return t('cloudBadCredentials')
  }
  if (code === 'weak_password') return t('cloudWeakPassword')
  return message || t('cloudError')
}

export function CloudAccount() {
  const t = useT()
  const [status, setStatus] = useState<CloudStatus>(getCloudStatus().status)
  const [user, setUser] = useState<User | null>(getCloudStatus().user)
  const [error, setError] = useState<string | undefined>(getCloudStatus().error)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState(false)
  const saved = useSave((state) => state)
  const localSummary = useMemo(() => summarizeSave(saved), [saved])
  const localHasProgress = hasProgress(localSummary)

  useEffect(() => subscribeCloud((next, nextUser, nextError) => {
    setStatus(next)
    setUser(nextUser)
    setError(nextError)
  }), [])

  if (!isSupabaseConfigured()) {
    return (
      <section className="settings-group">
        <h2>{t('cloudAccount')}</h2>
        <p className="settings-help">{t('cloudDisabledHelp')}</p>
      </section>
    )
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setBusy(true)
    playSound('button')
    try {
      if (mode === 'signin') {
        await signIn(login, password)
      } else {
        await signUp(login, password)
        setJustCreated(true)
      }
    } catch (err) {
      setFormError(authErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="settings-group cloud-account">
      <h2>{t('cloudAccount')}</h2>
      <p className="settings-help">{t('cloudAccountHelp')}</p>
      <p className="cloud-status" data-status={status}>
        {statusLabel(status, t)}
        {user ? ` · ${accountLabel(user)}` : ''}
      </p>
      {error && status === 'error' && (
        <p className="cloud-form-error" role="alert">
          {error}
        </p>
      )}

      {user && justCreated && (
        <p className="cloud-form-info" role="status">
          {t('cloudSignUpDone', { name: accountLabel(user) })}
        </p>
      )}

      {!user && mode === 'signin' && localHasProgress && (
        <p className="cloud-nudge">{t('cloudUnsavedNudge')}</p>
      )}

      {user ? (
        <div className="cloud-actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || status === 'syncing'}
            onClick={() => {
              playSound('button')
              setBusy(true)
              void syncNow().finally(() => setBusy(false))
            }}
          >
            {t('cloudSyncNow')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => {
              playSound('button')
              setBusy(true)
              void signOut()
                .catch((err) =>
                  setFormError(err instanceof Error ? err.message : t('cloudError')),
                )
                .finally(() => setBusy(false))
            }}
          >
            {t('cloudSignOut')}
          </button>
        </div>
      ) : (
        <form className="cloud-form" onSubmit={onSubmit}>
          <label className="cloud-field">
            <span>{t('cloudUsername')}</span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={login}
              onChange={(event) => setLogin(event.target.value)}
            />
          </label>
          <label className="cloud-field">
            <span>{t('cloudPassword')}</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {mode === 'signup' && (
            <p className="settings-help">{t('cloudSignUpHelp')}</p>
          )}
          {mode === 'signup' && localHasProgress && (
            <div className="sync-carry">
              <p className="sync-carry-title">{t('cloudCarryProgress')}</p>
              <SummaryList summary={localSummary} />
            </div>
          )}
          {mode === 'signin' && (
            <p className="settings-help">
              {t('cloudSignInEmailHint')}
              {localHasProgress && ` ${t('cloudSignInChoiceHint')}`}
            </p>
          )}
          {formError && (
            <p className="cloud-form-error" role="alert">
              {formError}
            </p>
          )}
          <div className="cloud-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {mode === 'signin' ? t('cloudSignIn') : t('cloudSignUp')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                playSound('button')
                setMode(mode === 'signin' ? 'signup' : 'signin')
                setFormError(null)
              }}
            >
              {mode === 'signin' ? t('cloudNeedAccount') : t('cloudHaveAccount')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
