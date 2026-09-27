import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MatchBar } from '../components/MatchBar'
import { Board } from '../components/Board'
import { Modal } from '../components/Modal'
import { Stars } from '../components/Stars'
import { FlameIcon } from '../components/FlameIcon'
import { useContent } from '../data/content'
import { avatarsUnlockedBetween, type AvatarOption } from '../lib/avatars'
import { formatTime } from '../lib/board'
import { getCloudStatus } from '../lib/cloudSync'
import {
  computeDailyStats,
  dailyKey,
  dailyRules,
  dailyScore,
  dailySeed,
  PENALTY_SECONDS,
  prizeAvatarsEarned,
  resultKey,
  streakLabel,
} from '../lib/daily'
import { fetchLeaderboard, submitDailyResult } from '../lib/dailyCloud'
import {
  markDailyStarted,
  markDailySubmitted,
  readState,
  recordDaily,
  setSetting,
  useSave,
  type DailyResult,
} from '../lib/save'
import { playSound, playStarSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import { useMatch } from '../lib/useMatch'

type RankState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'unavailable' }
  | { status: 'ready'; rank: number; total: number }

export function DailyGame() {
  const { cards, levels } = useContent()
  const country = useSave((state) => state.settings.country)
  const [params] = useSearchParams()

  /* Freeze the day at entry so a match running past midnight stays on its board. */
  const [day] = useState(() => dailyKey())
  const key = resultKey(day, country)
  const [practice] = useState(() => {
    const daily = readState().daily
    return params.has('practice') || Boolean(daily.results[key]) || daily.started.includes(key)
  })

  const rules = useMemo(() => dailyRules(day, levels), [day, levels])
  const seed = useMemo(() => dailySeed(day, country), [day, country])

  return (
    <DailyMatch
      key={`${key}-${practice}`}
      day={day}
      resultKey={key}
      practice={practice}
      rules={rules}
      seed={seed}
      deck={cards}
    />
  )
}

interface DailyMatchProps {
  day: string
  resultKey: string
  practice: boolean
  rules: ReturnType<typeof dailyRules>
  seed: number
  deck: ReturnType<typeof useContent>['cards']
}

function DailyMatch({ day, resultKey: key, practice, rules, seed, deck }: DailyMatchProps) {
  const t = useT()
  const navigate = useNavigate()
  const country = useSave((state) => state.settings.country)
  const currentAvatar = useSave((state) => state.settings.avatarId)
  const match = useMatch(rules, deck, { seed })
  const { phase, result } = match

  const [confirmQuit, setConfirmQuit] = useState(false)
  const [finished, setFinished] = useState<DailyResult | null>(null)
  const [streak, setStreak] = useState(0)
  const [newAvatars, setNewAvatars] = useState<AvatarOption[]>([])
  const [rank, setRank] = useState<RankState>({ status: 'idle' })
  const savedRef = useRef(false)

  /* Entering the board spends the official attempt, even if the player leaves. */
  useEffect(() => {
    if (!practice) markDailyStarted(key)
  }, [practice, key])

  useEffect(() => {
    if (phase === 'peek' || phase === 'playing') {
      savedRef.current = false
      setFinished(null)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'won' || !result || savedRef.current) return
    savedRef.current = true
    playStarSound(result.stars)

    const entry: DailyResult = {
      day,
      country,
      cards: rules.cards,
      seconds: result.seconds,
      mistakes: result.mistakes,
      stars: result.stars,
      submitted: false,
    }
    setFinished(entry)
    if (practice) return

    const before = computeDailyStats(readState().daily, day)
    recordDaily(key, entry)
    const after = computeDailyStats(readState().daily, day)
    setStreak(after.currentStreak)
    setNewAvatars(
      avatarsUnlockedBetween(prizeAvatarsEarned(before), prizeAvatarsEarned(after)),
    )

    if (!getCloudStatus().user) {
      setRank({ status: 'signedOut' })
      return
    }
    setRank({ status: 'loading' })
    void (async () => {
      const { playerName, avatarId } = readState().settings
      const sent = await submitDailyResult(entry, playerName, avatarId)
      if (sent) markDailySubmitted(key)
      const board = sent ? await fetchLeaderboard(day, country) : null
      setRank(
        board?.myRank
          ? { status: 'ready', rank: board.myRank, total: board.total }
          : { status: 'unavailable' },
      )
    })()
  }, [country, day, key, phase, practice, result, rules.cards])

  const quit = () => {
    playSound('transition')
    navigate('/daily')
  }

  return (
    <main id="main-content" className="screen screen-game" data-cards={rules.cards} tabIndex={-1}>
      <MatchBar
        title={practice ? t('dailyPracticeTitle') : t('dailyTitle')}
        remaining={match.remaining}
        elapsed={match.elapsed}
        noLimit={match.noLimit}
        limit={rules.seconds}
        mistakes={match.mistakes}
        pairsMade={match.pairsMade}
        totalPairs={match.totalPairs}
        onPause={match.pause}
      />

      <Board
        tiles={match.tiles}
        columns={rules.columns}
        rows={rules.rows}
        back={rules.back}
        revealing={match.revealAll}
        fogPhase={match.fogPhase}
        onFlip={match.flip}
      />

      {match.revealAll && <p className="peek-notice">{t('memorize')}</p>}

      <Modal
        open={match.paused && !confirmQuit && phase === 'playing'}
        onClose={match.resume}
      >
        <h2 className="modal-title">{t('paused')}</h2>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={match.resume}>
            {t('continue')}
          </button>
          {practice && (
            <button type="button" className="btn-secondary" onClick={match.restart}>
              {t('restart')}
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => (practice ? quit() : setConfirmQuit(true))}
          >
            {t('quit')}
          </button>
        </div>
      </Modal>

      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)}>
        <h2 className="modal-title">{t('matchInProgress')}</h2>
        <p className="modal-text">{t('dailyConfirmQuit')}</p>
        <div className="modal-actions">
          <button type="button" className="btn-danger" onClick={quit}>
            {t('quit')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmQuit(false)}
          >
            {t('cancel')}
          </button>
        </div>
      </Modal>

      <Modal open={phase === 'won' && finished !== null}>
        {finished && (
          <div className="daily-finish">
            <h2 className="modal-title">
              {practice ? t('dailyPracticeDone') : t('dailyComplete')}
            </h2>
            <Stars count={finished.stars} />
            <dl className="summary">
              <div>
                <dt>{t('yourTime')}</dt>
                <dd>{formatTime(finished.seconds)}</dd>
              </div>
              <div>
                <dt>{t('dailyPenalty')}</dt>
                <dd>+{finished.mistakes * PENALTY_SECONDS}s</dd>
              </div>
              <div>
                <dt>{t('dailyTotal')}</dt>
                <dd>{formatTime(dailyScore(finished.seconds, finished.mistakes))}</dd>
              </div>
            </dl>

            {practice ? (
              <p className="modal-text-muted">{t('dailyPracticeNote')}</p>
            ) : (
              <>
                <p className="daily-finish-streak">
                  <FlameIcon />
                  {streakLabel(t, streak)}
                </p>
                <p className="daily-finish-rank">
                  {rank.status === 'loading' && t('dailyLoading')}
                  {rank.status === 'signedOut' && t('dailyLeaderboardSignIn')}
                  {rank.status === 'unavailable' && t('dailyLeaderboardUnavailable')}
                  {rank.status === 'ready' &&
                    t('dailyRank', { a: rank.rank, b: rank.total })}
                </p>
              </>
            )}

            {newAvatars.length > 0 && (
              <div className="daily-prize">
                <p className="reward-title">
                  {newAvatars.length === 1
                    ? t('dailyNewAvatar')
                    : t('dailyNewAvatars', { n: newAvatars.length })}
                </p>
                <div className="daily-prize-avatars">
                  {newAvatars.map((avatar) => (
                    <figure key={avatar.id} className="daily-prize-avatar">
                      <img src={avatar.image} alt="" />
                      <figcaption>{avatar.name}</figcaption>
                    </figure>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={currentAvatar === newAvatars[0]!.id}
                  onClick={() => {
                    playSound('button')
                    setSetting('avatarId', newAvatars[0]!.id)
                  }}
                >
                  {currentAvatar === newAvatars[0]!.id
                    ? t('dailyAvatarInUse')
                    : t('dailyUseAvatar')}
                </button>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={quit}>
                {t('dailyBack')}
              </button>
              {practice && (
                <button type="button" className="btn-secondary" onClick={match.restart}>
                  {t('tryAgain')}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </main>
  )
}
