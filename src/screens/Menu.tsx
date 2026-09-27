import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AvatarPicker, PlayerBadge } from '../components/AvatarPicker'
import { MuteButton } from '../components/MuteButton'
import { FlameIcon } from '../components/FlameIcon'
import { Modal } from '../components/Modal'
import { DonateButton } from '../components/DonateButton'
import { PancitoSprite, PancitoTip } from '../components/PancitoGuide'
import { STAR_TIP } from '../components/Stars'
import {
  COUNTRY_NAME,
  COUNTRIES,
  countryAvailable,
  useContent,
} from '../data/content'
import { unlockedStories, totalStars, achievementProgress, summarizePlayer } from '../data/progression'
import { creditsText } from '../content/legal/credits'
import { TERMS_VERSION, termsText } from '../content/legal/terms'
import { setSetting, progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import { streakLabel, todayResult, useDailyStats } from '../lib/daily'
import type { CountryCode, Language } from '../types'

export function Menu() {
  const navigate = useNavigate()
  const t = useT()
  const { levels, stories, country, tests, achievements } = useContent()

  const settings = useSave((state) => state.settings)
  const progress = useSave(() => progressFor(settings.country))
  const dailyStats = useDailyStats()
  const dailyDone = useSave((state) =>
    Boolean(todayResult(state.daily, settings.country)),
  )

  const [creditsOpen, setCreditsOpen] = useState(false)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const stars = totalStars(progress)
  const maximum = levels.length * 3
  const unlocked = unlockedStories(stories, levels, progress).size
  const allStoriesDone = unlocked > 0 && unlocked >= stories.length

  const summary = useMemo(
    () => summarizePlayer(levels, stories, progress, dailyStats),
    [levels, stories, progress, dailyStats],
  )
  const achievementsEarned = achievements.filter(
    (item) => achievementProgress(item, summary) >= item.objetivo,
  ).length
  const allAchievementsDone =
    achievements.length > 0 && achievementsEarned >= achievements.length
  const testsPerfect = tests.filter(
    (test) => (progress.tests[String(test.nivel)]?.bestScore ?? 0) >= 10,
  ).length
  const allTestsPerfect = tests.length > 0 && testsPerfect >= tests.length

  const go = (path: string) => {
    playSound('transition')
    navigate(path)
  }

  return (
    <main id="main-content" className="screen screen-menu" tabIndex={-1}>
      <header className="menu-header">
        <div className="menu-header-top">
          <PlayerBadge
            name={settings.playerName}
            avatarId={settings.avatarId}
            onClick={() => {
              playSound('button')
              setProfileOpen(true)
            }}
          />
          <div className="menu-header-tools">
            <MuteButton compact />
            <div className="star-counter">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR_TIP} />
              </svg>
              <span>{t('starsOf', { a: stars, b: maximum })}</span>
            </div>
          </div>
        </div>
        <h1 className="menu-title">Memory History</h1>
        <div className="country-picker">
          <p className="country-picker-label">{t('countries')}</p>
          <button
            type="button"
            className="country-current"
            onClick={() => {
              playSound('transition')
              setCountryPickerOpen(true)
            }}
          >
            {country.bandera && (
              <img
                className="country-flag-lg"
                src={country.bandera}
                alt=""
                draggable={false}
              />
            )}
            <span className="country-current-name">
              {settings.language === 'es' ? country.es : country.en}
            </span>
          </button>
        </div>
      </header>

      <PancitoTip
        tipId="menu-play"
        textKey="tipMenuPlay"
        pose="happy"
        className="pancito-tip-menu"
      />

      <nav className="menu-buttons">
        <button type="button" className="btn-primary" onClick={() => go('/levels')}>
          {t('play')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-trophy={allStoriesDone || undefined}
          onClick={() => go('/stories')}
        >
          {allStoriesDone && <span className="tab-trophy" aria-hidden="true" />}
          {t('stories')}
          <span className="btn-note">
            {unlocked}/{stories.length}
          </span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-trophy={allTestsPerfect || undefined}
          onClick={() => go('/tests')}
        >
          {allTestsPerfect && <span className="tab-trophy" aria-hidden="true" />}
          {t('tests')}
          <span className="btn-note">
            {testsPerfect}/{tests.length}
          </span>
        </button>
        <button
          type="button"
          className="btn-secondary"
          data-trophy={allAchievementsDone || undefined}
          onClick={() => go('/achievements')}
        >
          {allAchievementsDone && (
            <span className="tab-trophy" aria-hidden="true" />
          )}
          {t('achievements')}
          <span className="btn-note">
            {achievementsEarned}/{achievements.length}
          </span>
        </button>
        <button type="button" className="btn-secondary" onClick={() => go('/free')}>
          {t('freePlay')}
        </button>
        <button type="button" className="btn-secondary" onClick={() => go('/duel')}>
          {t('duel')}
        </button>
        <button
          type="button"
          className="btn-secondary btn-daily"
          data-pending={!dailyDone || undefined}
          aria-label={`${t('dailyTitle')}. ${streakLabel(t, dailyStats.currentStreak)}${dailyDone ? '' : `. ${t('dailyPending')}`}`}
          onClick={() => go('/daily')}
        >
          {!dailyDone && <span className="btn-daily-dot" aria-hidden="true" />}
          {t('dailyShort')}
          {dailyStats.currentStreak > 0 && (
            <span className="btn-note btn-daily-streak" aria-hidden="true">
              <FlameIcon />
              {dailyStats.currentStreak}
            </span>
          )}
        </button>
        <div className="menu-settings-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => go('/settings')}
          >
            {t('settings')}
          </button>
          <button
            type="button"
            className="help-button"
            aria-label={t('help')}
            title={t('help')}
            onClick={() => {
              playSound('button')
              setGuideOpen(true)
            }}
          >
            ?
          </button>
        </div>
      </nav>

      <footer className="menu-footer">
        <DonateButton />
        <button
          type="button"
          className="link-subtle"
          onClick={() => {
            playSound('button')
            setCreditsOpen(true)
          }}
        >
          {t('credits')}
        </button>
      </footer>

      <Onboarding />

      <HowToPlay open={guideOpen} onClose={() => setGuideOpen(false)} />

      <Modal open={countryPickerOpen} onClose={() => setCountryPickerOpen(false)}>
        <h2 className="modal-title">{t('chooseCountry')}</h2>
        <CountryPicker
          current={settings.country}
          onPick={(code) => {
            playSound('button')
            setSetting('country', code)
            setCountryPickerOpen(false)
          }}
        />
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setCountryPickerOpen(false)}
        >
          {t('close')}
        </button>
      </Modal>

      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} width="wide">
        <h2 className="modal-title">{t('yourProfile')}</h2>
        <p className="modal-text-muted">{t('yourProfileHelp')}</p>
        <AvatarPicker
          initialName={settings.playerName}
          initialAvatarId={settings.avatarId}
          submitLabel="save"
          onSaved={() => setProfileOpen(false)}
        />
      </Modal>

      <Modal open={creditsOpen} onClose={() => setCreditsOpen(false)}>
        <h2 className="modal-title">{t('credits')}</h2>
        <pre className="credits-body">{creditsText(settings.language)}</pre>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreditsOpen(false)}
          >
            {t('close')}
          </button>
        </div>
      </Modal>
    </main>
  )
}

interface CountryPickerProps {
  current: CountryCode
  onPick: (code: CountryCode) => void
}

function CountryPicker({ current, onPick }: CountryPickerProps) {
  const t = useT()

  return (
    <div className="country-list">
      {COUNTRIES.map((code) => {
        const ready = countryAvailable(code)
        const flag = `/imagenes/banderas/${code.toLowerCase()}.webp`
        return (
          <button
            key={code}
            type="button"
            className="country-tile"
            data-active={code === current}
            disabled={!ready}
            onClick={() => onPick(code)}
          >
            <img
              className="country-flag country-flag-list"
              src={flag}
              alt=""
              draggable={false}
            />
            <span className="country-tile-name">{COUNTRY_NAME[code]}</span>
            {!ready && (
              <span className="country-tile-detail">{t('countryNotExported')}</span>
            )}
          </button>
        )
      })}
      {COMING_SOON.map((country) => (
        <div
          key={country.flag}
          className="country-tile country-tile-soon"
          aria-disabled="true"
          aria-label={`${country.name}. ${t('comingSoon')}`}
        >
          <img
            className="country-flag country-flag-list"
            src={country.flag}
            alt=""
            draggable={false}
          />
          <span className="country-tile-name">{country.name}</span>
          <span className="country-tile-soon-badge">{t('comingSoon')}</span>
        </div>
      ))}
    </div>
  )
}

/** Countries announced in the picker but not playable yet. */
const COMING_SOON = [{ name: 'Italia', flag: '/imagenes/banderas/it.svg' }]

interface HowToPlayProps {
  open: boolean
  onClose?: () => void
  buttonLabel?: 'continue' | 'close'
  onConfirm?: () => void
}

function HowToPlay({
  open,
  onClose,
  buttonLabel = 'close',
  onConfirm,
}: HowToPlayProps) {
  const t = useT()
  if (!open) return null

  return (
    <Modal open onClose={onClose} width="wide">
      <h2 className="modal-title">{t('howToPlay')}</h2>
      <div className="guide-with-pancito">
        <PancitoSprite pose="guide" className="guide-pancito" />
        <ol className="guide-steps">
          <li>{t('guideStep1')}</li>
          <li>{t('guideStep2')}</li>
          <li>{t('guideStep3')}</li>
          <li>{t('guideStep4')}</li>
          <li>{t('guideStep5')}</li>
        </ol>
      </div>
      <p className="modal-text-muted">{t('guideFooter')}</p>
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          playSound('button')
          onConfirm?.()
          onClose?.()
        }}
      >
        {t(buttonLabel)}
      </button>
    </Modal>
  )
}

function Onboarding() {
  const t = useT()
  const settings = useSave((state) => state.settings)
  const [accepted, setAccepted] = useState(false)

  if (!settings.languageChosen) {
    return (
      <Modal open>
        <h2 className="modal-title">{t('chooseLanguage')}</h2>
        <div className="language-row">
          {(['es', 'en'] as Language[]).map((language) => (
            <button
              key={language}
              type="button"
              className="btn-secondary"
              onClick={() => {
                playSound('button')
                setSetting('language', language)
                setSetting('languageChosen', true)
              }}
            >
              {language === 'es' ? 'Español' : 'English'}
            </button>
          ))}
        </div>
      </Modal>
    )
  }

  if (!settings.pancitoMet) {
    return (
      <Modal open>
        <div className="pancito-meet">
          <PancitoSprite pose="happy" className="pancito-meet-sprite" />
          <h2 className="modal-title">{t('meetPancitoTitle')}</h2>
          <p className="pancito-meet-body">{t('meetPancitoBody')}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              playSound('button')
              setSetting('pancitoMet', true)
            }}
          >
            {t('niceToMeetYou')}
          </button>
        </div>
      </Modal>
    )
  }

  if (!settings.profileSetupDone) {
    return (
      <Modal open width="wide">
        <h2 className="modal-title">{t('yourProfile')}</h2>
        <p className="modal-text-muted">{t('profileSetupHelp')}</p>
        <AvatarPicker
          initialName={settings.playerName}
          initialAvatarId={settings.avatarId}
          submitLabel="continue"
        />
      </Modal>
    )
  }

  if (!settings.guideSeen) {
    return (
      <HowToPlay
        open
        buttonLabel="continue"
        onConfirm={() => setSetting('guideSeen', true)}
      />
    )
  }

  if (!settings.termsAccepted || (settings.termsVersion ?? 0) < TERMS_VERSION) {
    return (
      <Modal open width="wide">
        <h2 className="modal-title">{t('termsTitle')}</h2>
        <p className="modal-text-muted">{t('termsHelp')}</p>
        <div className="terms-body" tabIndex={0}>
          {termsText(settings.language)}
        </div>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
          />
          <span>{t('termsAccept')}</span>
        </label>
        <button
          type="button"
          className="btn-primary"
          disabled={!accepted}
          onClick={() => {
            playSound('button')
            setSetting('termsAccepted', true)
            setSetting('termsVersion', TERMS_VERSION)
          }}
        >
          {t('startExploring')}
        </button>
      </Modal>
    )
  }

  return null
}
