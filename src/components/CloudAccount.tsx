import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SummaryList } from './SyncChoice'
import { DeleteAccountModal, RecoveryCodeModal } from './AccountModals'
import { Modal } from './Modal'
import { hasProgress, summarizeSave } from '../lib/saveSummary'
import { useSave } from '../lib/save'
import {
  accountLabel,
  createRecoveryCode,
  getCloudStatus,
  normalizeUsername,
  recoverAccount,
  signIn,
  signOut,
  signUp,
  subscribeCloud,
  syncNow,
  type CloudStatus,
} from '../lib/cloudSync'
import { isNameBlocked } from '../lib/nameFilter'
import { isSupabaseConfigured } from '../lib/supabase'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import type { User } from '@supabase/supabase-js'

type Mode = 'signin' | 'signup' | 'recover'

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
    case 'offline':
      return t('cloudOffline')
    case 'error':
      return t('cloudError')
  }
}

function authErrorMessage(err: unknown, t: ReturnType<typeof useT>): string {
  const message = err instanceof Error ? err.message : ''
  const code = (err as { code?: string } | null)?.code
  if (message === 'invalid_username') return t('cloudUsernameRules')
  if (message === 'blocked_name') return t('nameBlocked')
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return t('cloudUsernameTaken')
  }
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return t('cloudBadCredentials')
  }
  if (code === 'weak_password') return t('cloudWeakPassword')
  return message || t('cloudError')
}

export function CloudAccount({ initialMode = 'signin' }: { initialMode?: Mode } = {}) {
  const t = useT()
  const [status, setStatus] = useState<CloudStatus>(getCloudStatus().status)
  const [user, setUser] = useState<User | null>(getCloudStatus().user)
  const [error, setError] = useState<string | undefined>(getCloudStatus().error)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [shownCode, setShownCode] = useState<string | null>(null)
  const [confirmNewCode, setConfirmNewCode] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const saved = useSave((state) => state)
  const localSummary = useMemo(() => summarizeSave(saved), [saved])
  const localHasProgress = hasProgress(localSummary)

  useEffect(
    () =>
      subscribeCloud((next, nextUser, nextError) => {
        setStatus(next)
        setUser(nextUser)
        setError(nextError)
      }),
    [],
  )

  if (!isSupabaseConfigured()) {
    return (
      <section className="settings-group">
        <h2>{t('cloudAccount')}</h2>
        <p className="settings-help">{t('cloudDisabledHelp')}</p>
      </section>
    )
  }

  const switchMode = (next: Mode) => {
    playSound('button')
    setMode(next)
    setFormError(null)
    setInfo(null)
    setPassword('')
    setCode('')
  }

  /* A fresh code for the signed-in player. Quietly skipped if the server lacks accounts.sql. */
  const issueCode = async () => {
    try {
      setShownCode(await createRecoveryCode())
    } catch {
      setFormError(t('recoveryUnavailable'))
    }
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    setInfo(null)
    setBusy(true)
    playSound('button')
    try {
      if (mode === 'signin') {
        await signIn(login, password)
      } else if (mode === 'signup') {
        if (isNameBlocked(normalizeUsername(login))) throw new Error('blocked_name')
        await signUp(login, password)
        setInfo(t('cloudSignUpDone', { name: normalizeUsername(login) }))
        await issueCode()
      } else {
        const result = await recoverAccount(login, code, password)
        if (result.ok) {
          setInfo(t('recoverDone'))
          setShownCode(result.code)
        } else {
          setFormError(t(`recoverError_${result.error}` as const))
        }
      }
    } catch (err) {
      setFormError(authErrorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }

  const username = user ? accountLabel(user) : normalizeUsername(login)

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

      {info && (
        <p className="cloud-form-info" role="status">
          {info}
        </p>
      )}

      {!user && mode === 'signin' && localHasProgress && (
        <p className="cloud-nudge">{t('cloudUnsavedNudge')}</p>
      )}

      {user ? (
        <>
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
                setInfo(null)
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

          <div className="cloud-subsection">
            <p className="settings-help">{t('recoverySectionHelp')}</p>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                playSound('button')
                setConfirmNewCode(true)
              }}
            >
              {t('recoveryNewCode')}
            </button>
          </div>

          {formError && (
            <p className="cloud-form-error" role="alert">
              {formError}
            </p>
          )}

          <button
            type="button"
            className="link-subtle cloud-delete-link"
            onClick={() => {
              playSound('button')
              setDeleting(true)
            }}
          >
            {t('deleteAccountTitle')}
          </button>
        </>
      ) : (
        <form className="cloud-form" onSubmit={onSubmit}>
          {mode === 'recover' && <p className="settings-help">{t('recoverHelp')}</p>}
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
          {mode === 'recover' && (
            <label className="cloud-field">
              <span>{t('recoveryCodeLabel')}</span>
              <input
                type="text"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                required
                placeholder="XXXX-XXXX-XXXX-XXXX"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
              />
            </label>
          )}
          <label className="cloud-field">
            <span>{mode === 'recover' ? t('recoverNewPassword') : t('cloudPassword')}</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {mode === 'signup' && <p className="settings-help">{t('cloudSignUpHelp')}</p>}
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
              {mode === 'signin'
                ? t('cloudSignIn')
                : mode === 'signup'
                  ? t('cloudSignUp')
                  : t('recoverSubmit')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? t('cloudNeedAccount') : t('cloudHaveAccount')}
            </button>
          </div>
          {mode === 'signin' && (
            <button
              type="button"
              className="link-subtle cloud-forgot"
              onClick={() => switchMode('recover')}
            >
              {t('recoverLink')}
            </button>
          )}
        </form>
      )}

      <Modal open={confirmNewCode} onClose={() => setConfirmNewCode(false)}>
        <h2 className="modal-title">{t('recoveryNewCode')}</h2>
        <p className="modal-text">{t('recoveryNewCodeWarning')}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => {
              playSound('button')
              setConfirmNewCode(false)
              setFormError(null)
              setBusy(true)
              void issueCode().finally(() => setBusy(false))
            }}
          >
            {t('recoveryNewCodeConfirm')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmNewCode(false)}
          >
            {t('cancel')}
          </button>
        </div>
      </Modal>

      <RecoveryCodeModal code={shownCode} username={username} onClose={() => setShownCode(null)} />

      <DeleteAccountModal
        open={deleting}
        username={username}
        onClose={() => setDeleting(false)}
        onDeleted={() => {
          setDeleting(false)
          setInfo(t('deleteAccountDone'))
        }}
      />
    </section>
  )
}
