import { useMemo, useState, type FormEvent } from 'react'
import {
  avatarById,
  isValidPlayerName,
  listAvatarOptions,
  type AvatarOption,
} from '../lib/avatars'
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

      <p className="avatar-picker-label">{t('chooseAvatar')}</p>
      <div className="avatar-grid" role="listbox" aria-label={t('chooseAvatar')}>
        {options.map((option) => (
          <AvatarTile
            key={option.id}
            option={option}
            selected={option.id === avatarId}
            onSelect={() => {
              playSound('button')
              setAvatarId(option.id)
            }}
          />
        ))}
      </div>

      <button
        type="submit"
        className="btn-primary"
        disabled={!isValidPlayerName(name)}
      >
        {t(submitLabel)}
      </button>
    </form>
  )
}

function AvatarTile({
  option,
  selected,
  onSelect,
}: {
  option: AvatarOption
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className="avatar-tile"
      role="option"
      aria-selected={selected}
      data-selected={selected}
      title={option.name}
      onClick={onSelect}
    >
      <img src={option.image} alt="" draggable={false} />
      <span>{option.name}</span>
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
