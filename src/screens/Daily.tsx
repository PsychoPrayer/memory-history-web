import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { Stars } from '../components/Stars'
import { FlameIcon } from '../components/FlameIcon'
import {
  LeaderboardView,
  Passport,
  useLeaderboard,
  useSubmitPendingDaily,
} from '../components/DailyParts'
import { COUNTRY_NAME } from '../data/content'
import { PRIZE_AVATAR_TOTAL } from '../lib/avatars'
import { formatTime } from '../lib/board'
import {
  dailyCards,
  dailyKey,
  dailyScore,
  msUntilNextDay,
  nextStreakBonus,
  PENALTY_SECONDS,
  prizeAvatarsEarned,
  resultKey,
  streakLabel,
  useDailyStats,
} from '../lib/daily'
import { useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useLanguage, useT, type TextKey } from '../lib/i18n'

function useCountdown(): { hours: number; minutes: number; day: string } {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])
  const left = msUntilNextDay(now)
  return {
    hours: Math.floor(left / 3_600_000),
    minutes: Math.floor((left % 3_600_000) / 60_000),
    day: dailyKey(now),
  }
}

export function Daily() {
  const t = useT()
  const language = useLanguage()
  const navigate = useNavigate()
  const country = useSave((state) => state.settings.country)
  const daily = useSave((state) => state.daily)
  const stats = useDailyStats()
  const { hours, minutes, day } = useCountdown()

  const [refresh, setRefresh] = useState(0)
  const bump = useCallback(() => setRefresh((value) => value + 1), [])
  useSubmitPendingDaily(bump)
  const leaderboard = useLeaderboard(day, country, refresh)

  const key = resultKey(day, country)
  const result = daily.results[key]
  const attemptUsed = !result && daily.started.includes(key)
  const cards = dailyCards(day)

  const prizes = Math.min(prizeAvatarsEarned(stats), PRIZE_AVATAR_TOTAL)
  const bonus = nextStreakBonus(stats.bestStreak)

  const dateLabel = new Intl.DateTimeFormat(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))

  const start = (practice: boolean) => {
    playSound('transition')
    navigate(practice ? '/daily/play?practice=1' : '/daily/play')
  }

  return (
    <main id="main-content" className="screen screen-daily" tabIndex={-1}>
      <Header
        title={t('dailyTitle')}
        right={
          <span
            className="header-counter daily-header-streak"
            aria-label={streakLabel(t, stats.currentStreak)}
          >
            <FlameIcon />
            {stats.currentStreak}
          </span>
        }
      />

      <section className="daily-today" aria-labelledby="daily-today-title">
        <div className="daily-today-head">
          <p className="daily-date">{dateLabel}</p>
          <h2 id="daily-today-title" className="daily-today-title">
            {t(`dailyLevel${cards}` as TextKey)}
          </h2>
          <p className="daily-today-meta">
            {t('dailyCardsCountry', { n: cards, country: COUNTRY_NAME[country] })}
          </p>
        </div>

        {result ? (
          <div className="daily-result">
            <p className="daily-result-label">{t('dailyYourResult')}</p>
            <Stars count={result.stars} />
            <dl className="summary">
              <div>
                <dt>{t('yourTime')}</dt>
                <dd>{formatTime(result.seconds)}</dd>
              </div>
              <div>
                <dt>{t('yourMistakes')}</dt>
                <dd>{result.mistakes}</dd>
              </div>
              <div>
                <dt>{t('dailyTotal')}</dt>
                <dd>{formatTime(dailyScore(result.seconds, result.mistakes))}</dd>
              </div>
            </dl>
            <button type="button" className="btn-secondary" onClick={() => start(true)}>
              {t('dailyPractice')}
            </button>
          </div>
        ) : attemptUsed ? (
          <div className="daily-result">
            <p className="daily-note">{t('dailyAttemptUsed')}</p>
            <button type="button" className="btn-secondary" onClick={() => start(true)}>
              {t('dailyPractice')}
            </button>
          </div>
        ) : (
          <>
            <ul className="daily-rules">
              <li>{t('dailyRule1')}</li>
              <li>{t('dailyRule2', { n: PENALTY_SECONDS })}</li>
              <li>{t('dailyRule3')}</li>
            </ul>
            <button type="button" className="btn-primary daily-start" onClick={() => start(false)}>
              {t('dailyStart')}
            </button>
          </>
        )}

        <p className="daily-countdown">{t('dailyNextIn', { h: hours, m: minutes })}</p>
      </section>

      <section className="daily-stats" aria-label={t('dailyStreak')}>
        <div className="daily-stat daily-stat-streak">
          <FlameIcon />
          <span className="daily-stat-value">{stats.currentStreak}</span>
          <span className="daily-stat-label">{t('dailyStreak')}</span>
        </div>
        <div className="daily-stat">
          <span className="daily-stat-value">{stats.bestStreak}</span>
          <span className="daily-stat-label">{t('dailyBestStreak')}</span>
        </div>
        <div className="daily-stat">
          <span className="daily-stat-value">{stats.daysPlayed}</span>
          <span className="daily-stat-label">{t('dailyDaysPlayed')}</span>
        </div>
        <div className="daily-stat">
          <span className="daily-stat-value">
            {prizes}
            <small>/{PRIZE_AVATAR_TOTAL}</small>
          </span>
          <span className="daily-stat-label">{t('dailyPrizes')}</span>
        </div>
      </section>

      <p className="daily-prize-rule">
        {t('dailyPrizeRule')}
        {bonus && (
          <>
            {' '}
            <strong>
              {bonus.avatars === 1
                ? t('dailyNextBonusOne', { n: bonus.days })
                : t('dailyNextBonus', { n: bonus.days, a: bonus.avatars })}
            </strong>
          </>
        )}
      </p>

      <section className="settings-group daily-panel">
        <h2>{t('dailyLeaderboard')}</h2>
        <p className="settings-help">
          {t('dailyLeaderboardHelp', { country: COUNTRY_NAME[country] })}
        </p>
        <LeaderboardView state={leaderboard} />
      </section>

      <section className="settings-group daily-panel">
        <h2>{t('dailyPassport')}</h2>
        <p className="settings-help">{t('dailyPassportHelp')}</p>
        <Passport stats={stats} />
      </section>
    </main>
  )
}
