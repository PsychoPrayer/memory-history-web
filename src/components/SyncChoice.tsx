import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import {
  resolveConflict,
  subscribeConflict,
  type SyncChoice as Choice,
  type SyncConflict,
} from '../lib/cloudSync'
import { summarizeSave, type SaveSummary } from '../lib/saveSummary'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

/** Shown after signing in when this device and the account both have different progress. */
export function SyncChoice() {
  const t = useT()
  const [conflict, setConflict] = useState<SyncConflict | null>(null)
  const [confirming, setConfirming] = useState<Exclude<Choice, 'merge'> | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(
    () =>
      subscribeConflict((value) => {
        setConflict(value)
        setConfirming(null)
        setBusy(false)
      }),
    [],
  )

  if (!conflict) return null

  const device = summarizeSave(conflict.local)
  const account = summarizeSave(conflict.remote)

  const choose = (choice: Choice) => {
    playSound('button')
    setBusy(true)
    void resolveConflict(choice).finally(() => setBusy(false))
  }

  if (confirming) {
    const lost = confirming === 'account' ? device : account
    return (
      <Modal open width="wide">
        <h2 className="modal-title">{t('syncConfirmTitle')}</h2>
        <p className="modal-text">
          {confirming === 'account' ? t('syncConfirmAccount') : t('syncConfirmDevice')}
        </p>
        <SummaryList summary={lost} />
        <div className="modal-actions">
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => choose(confirming)}
          >
            {t('syncConfirmYes')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => setConfirming(null)}
          >
            {t('back')}
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal open width="wide">
      <h2 className="modal-title">{t('syncTitle')}</h2>
      <p className="modal-text">{t('syncBody', { name: conflict.accountName })}</p>

      <div className="sync-compare">
        <div className="sync-side">
          <p className="sync-side-title">{t('syncDevice')}</p>
          <SummaryList summary={device} />
        </div>
        <div className="sync-side">
          <p className="sync-side-title">{t('syncAccount', { name: conflict.accountName })}</p>
          <SummaryList summary={account} />
        </div>
      </div>

      <div className="sync-options">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={() => choose('merge')}
        >
          {t('syncMerge')}
        </button>
        <p className="sync-option-help">{t('syncMergeHelp')}</p>

        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => setConfirming('account')}
        >
          {t('syncUseAccount')}
        </button>
        <p className="sync-option-help">{t('syncUseAccountHelp')}</p>

        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => setConfirming('device')}
        >
          {t('syncUseDevice')}
        </button>
        <p className="sync-option-help">{t('syncUseDeviceHelp')}</p>
      </div>
    </Modal>
  )
}

export function SummaryList({ summary }: { summary: SaveSummary }) {
  const t = useT()
  return (
    <dl className="sync-summary">
      <div>
        <dt>{t('stars')}</dt>
        <dd>{summary.stars}</dd>
      </div>
      <div>
        <dt>{t('syncLevels')}</dt>
        <dd>{summary.levels}</dd>
      </div>
      <div>
        <dt>{t('syncStories')}</dt>
        <dd>{summary.storiesRead}</dd>
      </div>
      <div>
        <dt>{t('syncDaily')}</dt>
        <dd>{summary.dailyDays}</dd>
      </div>
    </dl>
  )
}
