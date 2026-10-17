import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { CloudAccount } from './CloudAccount'
import { PancitoSprite } from './PancitoGuide'
import { getCloudStatus, subscribeCloud } from '../lib/cloudSync'
import { isSupabaseConfigured } from '../lib/supabase'
import { markTipSeen, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

const TIP_ID = 'account-prompt'

/**
 * Asks once whether the player wants a cloud account. Accounts stay optional:
 * "Not now" closes it for good, and Settings → Cloud account is always there.
 */
export function AccountPrompt() {
  const t = useT()
  const seen = useSave((state) => (state.settings.tipsSeen ?? []).includes(TIP_ID))
  const [signedIn, setSignedIn] = useState(Boolean(getCloudStatus().user))
  const [creating, setCreating] = useState(false)

  useEffect(() => subscribeCloud((_status, user) => setSignedIn(Boolean(user))), [])

  /* Already signed in before ever seeing the question: nothing to ask. */
  useEffect(() => {
    if (!seen && signedIn && !creating) markTipSeen(TIP_ID)
  }, [seen, signedIn, creating])

  if (seen || !isSupabaseConfigured() || (signedIn && !creating)) return null

  const close = () => {
    playSound('button')
    markTipSeen(TIP_ID)
  }

  if (creating) {
    return (
      <Modal open width="wide">
        <h2 className="modal-title">{t('accountPromptCreateTitle')}</h2>
        <CloudAccount initialMode="signup" />
        <div className="modal-actions">
          <button type="button" className={signedIn ? 'btn-primary' : 'btn-secondary'} onClick={close}>
            {signedIn ? t('continue') : t('accountPromptLater')}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open>
      <div className="account-prompt">
        <PancitoSprite pose="guide" className="account-prompt-sprite" />
        <h2 className="modal-title">{t('accountPromptTitle')}</h2>
        <p className="modal-text">{t('accountPromptBody')}</p>
        <p className="modal-text-muted">{t('accountPromptOptional')}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              playSound('button')
              setCreating(true)
            }}
          >
            {t('accountPromptYes')}
          </button>
          <button type="button" className="btn-secondary" onClick={close}>
            {t('accountPromptLater')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
