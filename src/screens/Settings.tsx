import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AvatarPicker, PlayerBadge } from '../components/AvatarPicker'
import { CloudAccount } from '../components/CloudAccount'
import { DonateButton } from '../components/DonateButton'
import { Header } from '../components/Header'
import { Modal } from '../components/Modal'
import { isDonateConfigured } from '../lib/donate'
import {
  clearProgress,
  setSetting,
  useSave,
  type TimeAssist,
} from '../lib/save'
import { setMusicVolume, playSound, syncMuteToMusic } from '../lib/audio'
import { refitLayout } from '../lib/viewport'
import { MuteButton } from '../components/MuteButton'
import { useT } from '../lib/i18n'
import type { Language } from '../types'

export function Settings() {
  const t = useT()
  const navigate = useNavigate()
  const settings = useSave((state) => state.settings)
  const [confirming, setConfirming] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <main id="main-content" className="screen screen-settings" tabIndex={-1}>
      <Header title={t('settings')} />

      <section className="settings-group">
        <h2>{t('yourProfile')}</h2>
        <p className="settings-help">{t('yourProfileHelp')}</p>
        <div className="settings-profile-row">
          <PlayerBadge
            name={settings.playerName}
            avatarId={settings.avatarId}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              playSound('button')
              setProfileOpen(true)
            }}
          >
            {t('editProfile')}
          </button>
        </div>
      </section>

      <section className="settings-group">
        <h2>{t('language')}</h2>
        <div className="language-row" role="group" aria-label={t('language')}>
          {(['es', 'en'] as Language[]).map((language) => (
            <button
              key={language}
              type="button"
              className="tab"
              data-active={settings.language === language}
              aria-pressed={settings.language === language}
              onClick={() => {
                playSound('button')
                setSetting('language', language)
              }}
            >
              {language === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>{t('mute')}</h2>
        <p className="settings-help">{t('muteHelp')}</p>
        <MuteButton />
      </section>

      <section className="settings-group">
        <h2 id="music-volume-label">{t('music')}</h2>
        <Slider
          labelledBy="music-volume-label"
          label={t('musicVolume')}
          value={settings.musicVolume}
          onChange={(value) => {
            setSetting('musicVolume', value)
            if (!settings.muted) setMusicVolume(value)
            else syncMuteToMusic()
          }}
        />
      </section>

      <section className="settings-group">
        <h2 id="effects-volume-label">{t('soundEffects')}</h2>
        <Slider
          labelledBy="effects-volume-label"
          label={t('effectsVolume')}
          value={settings.effectsVolume}
          onChange={(value) => setSetting('effectsVolume', value)}
          onRelease={() => playSound('match')}
        />
      </section>

      <CloudAccount />

      <section className="settings-group">
        <h2>{t('display')}</h2>
        <p className="settings-help">{t('fitScreenHelp')}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            playSound('button')
            refitLayout()
          }}
        >
          {t('fitScreen')}
        </button>
      </section>

      <section className="settings-group">
        <h2>{t('accessibility')}</h2>
        <p className="settings-help">{t('timeAssistHelp')}</p>
        <fieldset className="settings-fieldset">
          <legend>{t('timeAssist')}</legend>
          {(
            [
              ['default', 'timeAssistDefault'],
              ['extra', 'timeAssistExtra'],
              ['unlimited', 'timeAssistUnlimited'],
            ] as const
          ).map(([value, labelKey]) => (
            <label key={value} className="settings-choice">
              <input
                type="radio"
                name="timeAssist"
                value={value}
                checked={settings.timeAssist === value}
                onChange={() => setSetting('timeAssist', value as TimeAssist)}
              />
              <span>{t(labelKey)}</span>
            </label>
          ))}
        </fieldset>
      </section>

      {isDonateConfigured() && (
        <section className="settings-group">
          <h2>{t('donate')}</h2>
          <p className="settings-help">{t('donateBlurb')}</p>
          <DonateButton variant="button" />
        </section>
      )}

      <section className="settings-group">
        <button
          type="button"
          className="btn-danger"
          onClick={() => setConfirming(true)}
        >
          {t('resetProgress')}
        </button>
      </section>

      <Modal open={confirming} onClose={() => setConfirming(false)}>
        <h2 className="modal-title">{t('resetProgress')}</h2>
        <p className="modal-text">{t('confirmResetProgress')}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              clearProgress(settings.country)
              setConfirming(false)
              navigate('/menu')
            }}
          >
            {t('yes')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirming(false)}
          >
            {t('no')}
          </button>
        </div>
      </Modal>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} width="wide">
        <h2 className="modal-title">{t('yourProfile')}</h2>
        <AvatarPicker
          initialName={settings.playerName}
          initialAvatarId={settings.avatarId}
          submitLabel="save"
          onSaved={() => setProfileOpen(false)}
        />
      </Modal>
    </main>
  )
}

interface SliderProps {
  value: number
  labelledBy: string
  label: string
  onChange: (value: number) => void
  onRelease?: () => void
}

function Slider({ value, labelledBy, label, onChange, onRelease }: SliderProps) {
  const percent = Math.round(value * 100)
  return (
    <div className="slider">
      <input
        type="range"
        min={0}
        max={100}
        value={percent}
        aria-labelledby={labelledBy}
        aria-label={label}
        aria-valuetext={`${percent}%`}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        onPointerUp={onRelease}
      />
      <span aria-hidden="true">{percent}%</span>
    </div>
  )
}
