import { useState } from 'react'
import { Modal } from './Modal'
import { deleteAccount } from '../lib/cloudSync'
import { clearAllProgress } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

interface RecoveryCodeModalProps {
  code: string | null
  username: string
  onClose: () => void
}

/** Shows a recovery code once; the player must confirm they saved it. */
export function RecoveryCodeModal({ code, username, onClose }: RecoveryCodeModalProps) {
  const t = useT()
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!code) return null

  const copy = async () => {
    playSound('button')
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const download = () => {
    playSound('button')
    const text = `${t('recoveryFileTitle')}\n\n${t('cloudUsername')}: ${username}\n${t('recoveryCodeLabel')}: ${code}\n\n${t('recoveryFileHelp')}\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `memory-history-${username}.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Modal open width="wide">
      <h2 className="modal-title">{t('recoveryTitle')}</h2>
      <p className="modal-text">{t('recoveryBody')}</p>
      <p className="recovery-code" aria-label={code.split('').join(' ')}>
        {code}
      </p>
      <div className="modal-actions recovery-actions">
        <button type="button" className="btn-secondary" onClick={copy}>
          {copied ? t('recoveryCopied') : t('recoveryCopy')}
        </button>
        <button type="button" className="btn-secondary" onClick={download}>
          {t('recoveryDownload')}
        </button>
      </div>
      <label className="checkbox recovery-check">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
        />
        <span>{t('recoverySavedCheck')}</span>
      </label>
      <button
        type="button"
        className="btn-primary"
        disabled={!saved}
        onClick={() => {
          playSound('button')
          setSaved(false)
          setCopied(false)
          onClose()
        }}
      >
        {t('continue')}
      </button>
    </Modal>
  )
}

interface DeleteAccountModalProps {
  open: boolean
  username: string
  onClose: () => void
  onDeleted: () => void
}

/** Type the username to confirm; optionally wipe this device's progress too. */
export function DeleteAccountModal({ open, username, onClose, onDeleted }: DeleteAccountModalProps) {
  const t = useT()
  const [typed, setTyped] = useState('')
  const [wipeLocal, setWipeLocal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = typed.trim().toLowerCase() === username.trim().toLowerCase()

  const close = () => {
    setTyped('')
    setWipeLocal(false)
    setError(null)
    onClose()
  }

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      await deleteAccount()
      if (wipeLocal) clearAllProgress()
      setTyped('')
      setWipeLocal(false)
      onDeleted()
    } catch {
      setError(t('deleteAccountFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={busy ? undefined : close}>
      <h2 className="modal-title">{t('deleteAccountTitle')}</h2>
      <p className="modal-text">{t('deleteAccountBody')}</p>
      <label className="cloud-field">
        <span>{t('deleteAccountType', { name: username })}</span>
        <input
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={wipeLocal}
          onChange={(event) => setWipeLocal(event.target.checked)}
        />
        <span>{t('deleteAccountWipeLocal')}</span>
      </label>
      {error && (
        <p className="cloud-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button
          type="button"
          className="btn-danger"
          disabled={!matches || busy}
          onClick={() => {
            playSound('button')
            void confirm()
          }}
        >
          {t('deleteAccountConfirm')}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={close}>
          {t('cancel')}
        </button>
      </div>
    </Modal>
  )
}
