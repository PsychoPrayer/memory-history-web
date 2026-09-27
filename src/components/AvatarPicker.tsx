import { useMemo, useState, type FormEvent } from 'react'
import {
  avatarById,
  isAvatarUnlocked,
  isValidPlayerName,
  listAvatarOptions,
  PRIZE_AVATAR_TOTAL,
  type AvatarOption,
} from '../lib/avatars'
import { prizeAvatarsEarned, useDailyStats } from '../lib/daily'
import { playSound } from '../lib/audio'
import { useT, type TextKey } from '../lib/i18n'
import { setSetting } from '../lib/save'

interface AvatarPickerProps {
  initialName?: string
  initialAvatarId?: string
  submitLabel?: Extract<TextKey, 'save' | 'continue'>
  onSaved?: () => void
}

export function AvatarPicker({
  initialName = '',
  initialAvatarId = 'ui:happy',
  submitLabel = 'save',
  onSaved,
}: AvatarPickerProps) {
  const t = useT()
  const options = useMemo(() => listAvatarOptions(), [])
  const [name, setName] = useState(initialName)
  const [avatarId, setAvatarId] = useState(initialAvatarId)
  const selected = avatarById(avatarId)
  const prizesEarned = prizeAvatarsEarned(useDailyStats())
  const prizesShown = Math.min(prizesEarned, PRIZE_AVATAR_TOTAL)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isValidPlayerName(name)) return
    playSound('button')
    setSetting('playerName', name.trim())
    setSetting('avatarId', avatarId)
    setSetting('profileSetupDone', true)
    onSaved?.()
  }

  return (
    <form className="avatar-picker" onSubmit={onSubmit}>
      <div className="avatar-picker-preview">
        <img
          className="avatar-picker-preview-img"
          src={selected.image}
          alt=""
          draggable={false}
        />
        <p className="avatar-picker-preview-name">
          {name.trim() || t('playerNamePlaceholder')}
        </p>
      </div>

      <label className="cloud-field">
        <span>{t('playerName')}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={16}
          required
          autoComplete="nickname"
          placeholder={t('playerNamePlaceholder')}
        />
      </label>
      <p className="settings-help">{t('playerNameHelp')}</p>

      <button
        type="submit"
        className="btn-primary avatar-picker-save"
        disabled={!isValidPlayerName(name)}
      >
        {t(submitLabel)}
      </button>

      <p className="avatar-picker-label">{t('chooseAvatar')}</p>
      <p className="avatar-prize-note">
        {t('avatarPrizesNote', { a: prizesShown, b: PRIZE_AVATAR_TOTAL })}
      </p>
      <div className="avatar-grid" role="listbox" aria-label={t('chooseAvatar')}>
        {options.map((option) => {
          /* A locked avatar someone already wears stays usable for them. */
          const usable =
            isAvatarUnlocked(option, prizesEarned) || option.id === initialAvatarId
          return (
            <AvatarTile
              key={option.id}
              option={option}
              selected={option.id === avatarId}
              locked={!usable}
              lockedLabel={t('avatarLocked')}
              onSelect={() => {
                playSound('button')
                setAvatarId(option.id)
              }}
            />
          )
        })}
      </div>
    </form>
  )
}

function AvatarTile({
  option,
  selected,
  locked,
  lockedLabel,
  onSelect,
}: {
  option: AvatarOption
  selected: boolean
  locked: boolean
  lockedLabel: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="avatar-tile"
      role="option"
      aria-selected={selected}
      aria-disabled={locked || undefined}
      aria-label={locked ? `${lockedLabel} ${option.prize}` : option.name}
      data-selected={selected}
      data-locked={locked || undefined}
      disabled={locked}
      title={locked ? lockedLabel : option.name}
      onClick={onSelect}
    >
      <img src={option.image} alt="" draggable={false} loading="lazy" />
      {locked && <span className="avatar-tile-lock" aria-hidden="true" />}
      <span>{locked ? `#${option.prize}` : option.name}</span>
    </button>
  )
}

interface PlayerBadgeProps {
  name: string
  avatarId: string
  onClick?: () => void
}

export function PlayerBadge({ name, avatarId, onClick }: PlayerBadgeProps) {
  const t = useT()
  const avatar = avatarById(avatarId)
  const label = name.trim() || t('playerAnonymous')

  const content = (
    <>
      <img className="player-badge-avatar" src={avatar.image} alt="" draggable={false} />
      <span className="player-badge-name">{label}</span>
    </>
  )

  if (!onClick) {
    return <div className="player-badge">{content}</div>
  }

  return (
    <button type="button" className="player-badge player-badge-button" onClick={onClick}>
      {content}
    </button>
  )
}
