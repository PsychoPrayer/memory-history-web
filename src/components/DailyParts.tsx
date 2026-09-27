import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { avatarById } from '../lib/avatars'
import { formatTime } from '../lib/board'
import { getCloudStatus, subscribeCloud } from '../lib/cloudSync'
import { dailyKey, shiftDay, type DailyStats } from '../lib/daily'
import {
  fetchLeaderboard,
  submitDailyResult,
  type LeaderboardState,
} from '../lib/dailyCloud'
import { markDailySubmitted, readState, useSave } from '../lib/save'
import { isSupabaseConfigured } from '../lib/supabase'
import { useLanguage, useT } from '../lib/i18n'
import type { CountryCode } from '../types'

/** Signed-in user id, kept in sync with the cloud session. */
export function useCloudUserId(): string | null {
  const [userId, setUserId] = useState(getCloudStatus().user?.id ?? null)
  useEffect(
    () => subscribeCloud((_status, user) => setUserId(user?.id ?? null)),
    [],
  )
  return userId
}

/**
 * Sends official results that were finished offline or before signing in.
 * Only recent days are accepted by the server, so older ones stay local.
 */
export function useSubmitPendingDaily(onSubmitted?: () => void) {
  const userId = useCloudUserId()
  const results = useSave((state) => state.daily.results)

  useEffect(() => {
    if (!userId) return
    const oldest = shiftDay(dailyKey(), -1)
    const pending = Object.entries(results).filter(
      ([, result]) => !result.submitted && result.day >= oldest,
    )
    if (pending.length === 0) return

    let cancelled = false
    void (async () => {
      const { playerName, avatarId } = readState().settings
      let any = false
      for (const [key, result] of pending) {
        const ok = await submitDailyResult(result, playerName, avatarId)
        if (cancelled) return
        if (ok) {
          markDailySubmitted(key)
          any = true
        }
      }
      if (any) onSubmitted?.()
    })()
    return () => {
      cancelled = true
    }
  }, [userId, results, onSubmitted])
}

export function useLeaderboard(
  day: string,
  country: CountryCode,
  refresh: number,
): LeaderboardState {
  const [state, setState] = useState<LeaderboardState>({ status: 'loading' })
  const userId = useCloudUserId()

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState({ status: 'unavailable' })
      return
    }
    let cancelled = false
    setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }))
    void fetchLeaderboard(day, country).then((board) => {
      if (cancelled) return
      setState(board ? { status: 'ready', board } : { status: 'unavailable' })
    })
    return () => {
      cancelled = true
    }
  }, [day, country, refresh, userId])

  return state
}

export function LeaderboardView({ state }: { state: LeaderboardState }) {
  const t = useT()
  const navigate = useNavigate()
  const userId = useCloudUserId()

  if (state.status === 'loading') {
    return <p className="daily-muted">{t('dailyLoading')}</p>
  }
  if (state.status === 'unavailable') {
    return <p className="daily-muted">{t('dailyLeaderboardUnavailable')}</p>
  }

  const { top, total, myRank } = state.board
  const meInTop = top.some((row) => row.userId === userId)

  return (
    <div className="leaderboard">
      {top.length === 0 ? (
        <p className="daily-muted">{t('dailyLeaderboardEmpty')}</p>
      ) : (
        <ol className="leaderboard-list">
          {top.map((row, index) => {
            const avatar = avatarById(row.avatarId)
            const mine = row.userId === userId
            return (
              <li key={row.userId} className="leaderboard-row" data-mine={mine || undefined}>
                <span className="leaderboard-rank" data-podium={index < 3 ? index + 1 : undefined}>
                  {index + 1}
                </span>
                <img className="leaderboard-avatar" src={avatar.image} alt="" loading="lazy" />
                <span className="leaderboard-name">
                  {row.name}
                  {mine && <span className="leaderboard-you">{t('dailyYou')}</span>}
                </span>
                <span className="leaderboard-score">
                  {formatTime(row.score)}
                  <small>
                    {t('dailyScoreDetail', {
                      time: formatTime(row.seconds),
                      n: row.mistakes,
                    })}
                  </small>
                </span>
              </li>
            )
          })}
        </ol>
      )}

      {myRank !== null && !meInTop && (
        <p className="leaderboard-me">{t('dailyRank', { a: myRank, b: total })}</p>
      )}

      {!userId && (
        <p className="daily-muted">
          {t('dailyLeaderboardSignIn')}{' '}
          <button type="button" className="link-subtle" onClick={() => navigate('/settings')}>
            {t('settings')}
          </button>
        </p>
      )}
    </div>
  )
}

/** Month grid of stamps. Weeks start on Monday. */
export function Passport({ stats }: { stats: DailyStats }) {
  const t = useT()
  const language = useLanguage()
  const today = dailyKey()
  const [month, setMonth] = useState(() => today.slice(0, 7))

  const { cells, title } = useMemo(() => {
    const [year, monthIndex] = month.split('-').map(Number) as [number, number]
    const first = new Date(Date.UTC(year, monthIndex - 1, 1))
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
    const leading = (first.getUTCDay() + 6) % 7
    const list: Array<string | null> = Array.from({ length: leading }, () => null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      list.push(`${month}-${String(day).padStart(2, '0')}`)
    }
    const label = new Intl.DateTimeFormat(language, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(first)
    return { cells: list, title: label }
  }, [month, language])

  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' })
    /* 2024-01-01 was a Monday. */
    return Array.from({ length: 7 }, (_, i) => format.format(new Date(Date.UTC(2024, 0, 1 + i))))
  }, [language])

  const shiftMonth = (delta: number) => {
    const [year, monthIndex] = month.split('-').map(Number) as [number, number]
    const next = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
    setMonth(next.toISOString().slice(0, 7))
  }

  const isCurrentMonth = month === today.slice(0, 7)

  return (
    <div className="passport">
      <div className="passport-head">
        <button
          type="button"
          className="btn-ghost"
          aria-label={t('dailyPrevMonth')}
          onClick={() => shiftMonth(-1)}
        >
          ‹
        </button>
        <p className="passport-title">{title}</p>
        <button
          type="button"
          className="btn-ghost"
          aria-label={t('dailyNextMonth')}
          disabled={isCurrentMonth}
          onClick={() => shiftMonth(1)}
        >
          ›
        </button>
      </div>
      <div className="passport-grid" role="grid" aria-label={title}>
        {weekdays.map((name, index) => (
          <span key={`w${index}`} className="passport-weekday" aria-hidden="true">
            {name}
          </span>
        ))}
        {cells.map((day, index) => {
          if (!day) return <span key={`e${index}`} className="passport-cell" data-empty />
          const stamp = stats.stampByDay.get(day)
          const played = stamp !== undefined
          const number = Number(day.slice(8))
          return (
            <span
              key={day}
              role="gridcell"
              className="passport-cell"
              data-played={played || undefined}
              data-stars={played ? stamp : undefined}
              data-today={day === today || undefined}
              data-future={day > today || undefined}
              aria-label={
                played
                  ? `${number}. ${t('starsOf', { a: stamp ?? 0, b: 3 })}`
                  : String(number)
              }
            >
              <span className="passport-day">{number}</span>
              {played && <span className="passport-stamp" aria-hidden="true" />}
            </span>
          )
        })}
      </div>
    </div>
  )
}
