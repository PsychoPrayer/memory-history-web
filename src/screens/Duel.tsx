import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { Board } from '../components/Board'
import { CloudAccount } from '../components/CloudAccount'
import { MatchBar } from '../components/MatchBar'
import { Modal } from '../components/Modal'
import { PancitoSprite } from '../components/PancitoGuide'
import { Stars } from '../components/Stars'
import { useContent } from '../data/content'
import { isUnlocked } from '../data/progression'
import { formatTime } from '../lib/board'
import {
  bothReady,
  claimUsername,
  createDuel,
  duelErrorMessage,
  fetchMatch,
  fetchMyProfile,
  fetchProfiles,
  fetchResults,
  forgetDuelRoom,
  forgetInviteCode,
  isHost,
  isValidUsername,
  joinDuel,
  leaveDuel,
  markPlaying,
  normalizeRoomCode,
  opponentId,
  recalledDuelRoom,
  recalledInviteCode,
  rememberDuelRoom,
  rememberInviteCode,
  rematchDuel,
  setReady,
  startCountdown,
  submitDuelResult,
  subscribeToMatch,
  updateMatchRules,
  type DuelMatch,
  type DuelProfile,
  type DuelResult,
} from '../lib/duel'
import { getCloudStatus, subscribeCloud } from '../lib/cloudSync'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import { progressFor, setSetting, useSave } from '../lib/save'
import { shareDuelInvite } from '../lib/share'
import { isSupabaseConfigured } from '../lib/supabase'
import { rulesFromLevel, useMatch } from '../lib/useMatch'
import type { Stars as StarCount } from '../types'

type HubMode = 'home' | 'join'

export function Duel() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const t = useT()
  const country = useSave((state) => state.settings.country)
  const [user, setUser] = useState<User | null>(getCloudStatus().user)
  const [profile, setProfile] = useState<DuelProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [match, setMatch] = useState<DuelMatch | null>(null)
  const [results, setResults] = useState<DuelResult[]>([])
  const [profiles, setProfiles] = useState<DuelProfile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [joiningInvite, setJoiningInvite] = useState(false)
  const [hubMode, setHubMode] = useState<HubMode>('home')
  const [joinCode, setJoinCode] = useState('')
  const [usernameDraft, setUsernameDraft] = useState('')
  const inviteJoinAttempted = useRef<string | null>(null)

  useEffect(() => subscribeCloud((_status, nextUser) => setUser(nextUser)), [])

  /* Capture ?code= from invite links (survives login / username setup). */
  useEffect(() => {
    const raw = searchParams.get('code')
    if (!raw) return
    const code = normalizeRoomCode(raw)
    if (!code) return
    rememberInviteCode(code)
    setJoinCode(code)
    setHubMode('join')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!match?.rules.country) return
    if (match.rules.country !== country) {
      setSetting('country', match.rules.country)
    }
  }, [match?.rules.country, country])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    setError(null)
    void fetchMyProfile(user.id)
      .then((next) => {
        if (!cancelled) setProfile(next)
      })
      .catch((err) => {
        if (!cancelled) {
          setProfile(null)
          setError(duelErrorMessage(err, 'duelError'))
        }
      })
      .finally(() => {
        setProfileLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  /* Rejoin the same room after refresh / leaving the duel screen briefly. */
  useEffect(() => {
    if (!user || !profile || match) return
    if (recalledInviteCode()) return
    const roomId = recalledDuelRoom()
    if (!roomId) return
    let cancelled = false
    void fetchMatch(roomId)
      .then((next) => {
        if (cancelled || !next) {
          forgetDuelRoom()
          return
        }
        const inRoom = next.host_id === user.id || next.guest_id === user.id
        if (!inRoom || next.status === 'cancelled') {
          forgetDuelRoom()
          return
        }
        setMatch(next)
      })
      .catch(() => {
        forgetDuelRoom()
      })
    return () => {
      cancelled = true
    }
  }, [user, profile, match])

  /* Auto-join from shared invite link once the player is ready. */
  useEffect(() => {
    if (!user || !profile || match || joiningInvite) return
    const code = recalledInviteCode()
    if (!code) return
    if (inviteJoinAttempted.current === code) return
    inviteJoinAttempted.current = code
    let cancelled = false
    setJoiningInvite(true)
    setError(null)
    void joinDuel(code)
      .then((next) => {
        if (cancelled) return
        forgetInviteCode()
        rememberDuelRoom(next.id)
        setMatch(next)
      })
      .catch(() => {
        if (cancelled) return
        forgetInviteCode()
        setHubMode('join')
        setJoinCode(code)
        setError(t('duelJoinFailed'))
      })
      .finally(() => {
        if (!cancelled) setJoiningInvite(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, profile, match, joiningInvite, t])

  const refreshMatch = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    if (!match?.id) return
    rememberDuelRoom(match.id)
    let cancelled = false

    const load = async () => {
      try {
        const next = await fetchMatch(match.id)
        if (cancelled || !next) return
        if (next.status === 'cancelled') {
          forgetDuelRoom()
          setMatch(null)
          setResults([])
          return
        }
        /* Host notices guest left — stay in lobby with open seat. */
        if (
          next.host_id === user?.id &&
          !next.guest_id &&
          next.status === 'lobby'
        ) {
          setMatch(next)
          setResults([])
          setProfiles(await fetchProfiles([next.host_id]))
          return
        }
        if (
          user &&
          next.host_id !== user.id &&
          next.guest_id !== user.id
        ) {
          forgetDuelRoom()
          setMatch(null)
          setResults([])
          return
        }
        setMatch(next)
        const nextResults = await fetchResults(next.id)
        if (cancelled) return
        setResults(nextResults)
        const ids = [next.host_id, next.guest_id].filter(Boolean) as string[]
        const nextProfiles = await fetchProfiles(ids)
        if (!cancelled) setProfiles(nextProfiles)
      } catch (err) {
        if (!cancelled) {
          setError(duelErrorMessage(err, 'duelError'))
        }
      }
    }

    refreshMatch.current = load
    void load()
    const poll = window.setInterval(() => {
      void load()
    }, 2500)
    const unsubscribe = subscribeToMatch(match.id, () => {
      void load()
    })
    return () => {
      cancelled = true
      window.clearInterval(poll)
      unsubscribe()
    }
  }, [match?.id, user?.id])

  const clearRoom = () => {
    forgetDuelRoom()
    setMatch(null)
    setResults([])
  }

  const exitRoom = async () => {
    if (!match) {
      clearRoom()
      return
    }
    setBusy(true)
    try {
      await leaveDuel(match.id)
    } catch {
      /* still leave locally */
    } finally {
      setBusy(false)
      clearRoom()
      if (user) void fetchMyProfile(user.id).then(setProfile)
    }
  }

  const goMenu = () => {
    playSound('transition')
    navigate('/menu')
  }

  if (!isSupabaseConfigured()) {
    return (
      <Shell title={t('duel')} onBack={goMenu}>
        <PancitoPanel pose="wait" body={t('cloudDisabledHelp')} />
      </Shell>
    )
  }

  if (!user) {
    return (
      <Shell title={t('duel')} onBack={goMenu}>
        <PancitoPanel pose="guide" body={t('duelNeedAccount')} />
        <CloudAccount />
      </Shell>
    )
  }

  if (profileLoading) {
    return (
      <Shell title={t('duel')} onBack={goMenu}>
        <p className="duel-muted">{t('duelLoading')}</p>
      </Shell>
    )
  }

  if (!profile) {
    const missingTables = error === 'DUEL_SETUP_NEEDED' || Boolean(
      error &&
        /duel_profiles|schema cache|does not exist|Could not find the table/i.test(
          error,
        ),
    )

    return (
      <Shell title={t('duel')} onBack={goMenu}>
        {missingTables ? (
          <>
            <PancitoPanel pose="wait" body={t('duelSetupNeeded')} />
            <ol className="duel-setup-steps">
              <li>{t('duelSetupStep1')}</li>
              <li>{t('duelSetupStep2')}</li>
              <li>{t('duelSetupStep3')}</li>
            </ol>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                playSound('button')
                setError(null)
                setProfileLoading(true)
                void fetchMyProfile(user.id)
                  .then(setProfile)
                  .catch((err) =>
                    setError(duelErrorMessage(err, t('duelError'))),
                  )
                  .finally(() => setProfileLoading(false))
              }}
            >
              {t('tryAgain')}
            </button>
          </>
        ) : (
          <>
            <PancitoPanel pose="happy" body={t('duelPickUsername')} />
            <form
              className="cloud-form"
              onSubmit={(event: FormEvent) => {
                event.preventDefault()
                setError(null)
                setBusy(true)
                playSound('button')
                void claimUsername(user, usernameDraft)
                  .then(setProfile)
                  .catch((err) => {
                    const message = duelErrorMessage(err, t('duelError'))
                    if (message === 'USERNAME_TAKEN') {
                      setError(t('duelUsernameTaken'))
                    } else if (message === 'DUEL_SETUP_NEEDED') {
                      setError('DUEL_SETUP_NEEDED')
                    } else {
                      setError(message)
                    }
                  })
                  .finally(() => setBusy(false))
              }}
            >
              <label className="cloud-field">
                <span>{t('duelUsername')}</span>
                <input
                  value={usernameDraft}
                  onChange={(event) => setUsernameDraft(event.target.value)}
                  minLength={3}
                  maxLength={16}
                  pattern="[A-Za-z0-9_]{3,16}"
                  required
                  autoComplete="username"
                  placeholder="PancitoFan"
                />
              </label>
              <p className="settings-help">{t('duelUsernameHelp')}</p>
              {error && (
                <p className="cloud-form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={busy || !isValidUsername(usernameDraft)}
              >
                {t('duelSaveUsername')}
              </button>
            </form>
          </>
        )}
      </Shell>
    )
  }

  if (!match) {
    if (joiningInvite) {
      return (
        <Shell title={t('duel')} onBack={goMenu}>
          <PancitoPanel pose="wait" body={t('duelJoiningInvite')} />
          <p className="duel-code">{joinCode || recalledInviteCode() || '…'}</p>
        </Shell>
      )
    }

    return (
      <Shell title={t('duel')} onBack={goMenu}>
        <div className="duel-profile-card">
          <PancitoSprite pose="happy" className="duel-profile-sprite" />
          <div>
            <p className="duel-username">{profile.username}</p>
            <p className="duel-record">
              {t('duelRecord', {
                w: profile.wins,
                l: profile.losses,
                d: profile.draws,
              })}
            </p>
          </div>
        </div>
        <PancitoPanel pose="guide" body={t('duelIntro')} />

        {hubMode === 'home' ? (
          <div className="duel-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => {
                setError(null)
                setBusy(true)
                playSound('button')
                void createDuel(user, { country, levelId: '' })
                  .then((next) => {
                    rememberDuelRoom(next.id)
                    setMatch(next)
                  })
                  .catch((err) =>
                    setError(duelErrorMessage(err, t('duelError'))),
                  )
                  .finally(() => setBusy(false))
              }}
            >
              {t('duelCreateRoom')}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                playSound('button')
                setHubMode('join')
              }}
            >
              {t('duelJoinRoom')}
            </button>
          </div>
        ) : (
          <form
            className="cloud-form"
            onSubmit={(event) => {
              event.preventDefault()
              setError(null)
              setBusy(true)
              playSound('button')
              void joinDuel(joinCode)
                .then((next) => {
                  rememberDuelRoom(next.id)
                  setMatch(next)
                })
                .catch(() => setError(t('duelJoinFailed')))
                .finally(() => setBusy(false))
            }}
          >
            <label className="cloud-field">
              <span>{t('duelRoomCode')}</span>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                maxLength={8}
                required
                autoCapitalize="characters"
                placeholder="ABC123"
              />
            </label>
            {error && (
              <p className="cloud-form-error" role="alert">
                {error}
              </p>
            )}
            <div className="cloud-actions">
              <button type="submit" className="btn-primary" disabled={busy}>
                {t('duelJoin')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  playSound('button')
                  setHubMode('home')
                  setError(null)
                }}
              >
                {t('back')}
              </button>
            </div>
          </form>
        )}
        {hubMode === 'home' && error && (
          <p className="cloud-form-error" role="alert">
            {error}
          </p>
        )}
      </Shell>
    )
  }

  if (
    match.status === 'countdown' ||
    match.status === 'playing' ||
    match.status === 'awaiting_results'
  ) {
    const myResult = results.find((r) => r.user_id === user.id)
    if (myResult) {
      return (
        <WaitingRoom
          match={match}
          profile={profile}
          profiles={profiles}
          onLeave={() => {
            void exitRoom().then(goMenu)
          }}
        />
      )
    }
    return (
      <DuelPlay
        key={`${match.id}-${match.starts_at ?? 'live'}`}
        match={match}
        userId={user.id}
        onSubmitted={async () => {
          await refreshMatch.current()
        }}
        onForfeit={async () => {
          try {
            await submitDuelResult(match.id, user.id, {
              completed: false,
              forfeited: true,
              durationMs: 0,
              mistakes: 999,
              stars: 0,
            })
            await refreshMatch.current()
          } catch (err) {
            setError(duelErrorMessage(err, t('duelError')))
          }
        }}
      />
    )
  }

  if (match.status === 'finished') {
    return (
      <VerdictRoom
        match={match}
        userId={user.id}
        results={results}
        profiles={profiles}
        busy={busy}
        onRematch={async () => {
          setBusy(true)
          setError(null)
          playSound('button')
          try {
            const next = await rematchDuel(match.id)
            setResults([])
            setMatch(next)
            void fetchMyProfile(user.id).then(setProfile)
          } catch (err) {
            const message = duelErrorMessage(err, t('duelError'))
            /* Other player already reset the room — just sync. */
            if (/not finished|no.*terminad/i.test(message)) {
              await refreshMatch.current()
              void fetchMyProfile(user.id).then(setProfile)
            } else {
              setError(message)
            }
          } finally {
            setBusy(false)
          }
        }}
        onLeaveRoom={async () => {
          playSound('transition')
          await exitRoom()
        }}
      />
    )
  }

  if (match.status === 'cancelled') {
    return (
      <Shell title={t('duel')} onBack={goMenu}>
        <PancitoPanel pose="wait" body={t('duelCancelled')} />
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            playSound('button')
            clearRoom()
          }}
        >
          {t('duelBackToHub')}
        </button>
      </Shell>
    )
  }

  return (
    <LobbyRoom
      match={match}
      userId={user.id}
      profile={profile}
      profiles={profiles}
      busy={busy}
      error={error}
      onError={setError}
      setBusy={setBusy}
      onLeave={() => {
        void exitRoom()
      }}
    />
  )
}

function Shell({
  title,
  onBack,
  children,
}: {
  title: string
  onBack: () => void
  children: ReactNode
}) {
  const t = useT()
  return (
    <main id="main-content" className="screen screen-duel" tabIndex={-1}>
      <header className="duel-header">
        <button type="button" className="btn-secondary duel-back" onClick={onBack}>
          {t('back')}
        </button>
        <h1 className="duel-title">{title}</h1>
      </header>
      <div className="duel-body">{children}</div>
    </main>
  )
}

function PancitoPanel({
  pose,
  body,
}: {
  pose: 'happy' | 'wait' | 'guide' | 'point'
  body: string
}) {
  return (
    <div className="duel-pancito-panel">
      <PancitoSprite pose={pose} className="duel-pancito" />
      <p className="duel-pancito-text">{body}</p>
    </div>
  )
}

function profileName(profiles: DuelProfile[], userId: string | null | undefined) {
  if (!userId) return '—'
  return profiles.find((p) => p.user_id === userId)?.username ?? '…'
}

function LobbyRoom({
  match,
  userId,
  profile,
  profiles,
  busy,
  error,
  onError,
  setBusy,
  onLeave,
}: {
  match: DuelMatch
  userId: string
  profile: DuelProfile
  profiles: DuelProfile[]
  busy: boolean
  error: string | null
  onError: (value: string | null) => void
  setBusy: (value: boolean) => void
  onLeave: () => void
}) {
  const t = useT()
  const { levels } = useContent()
  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))
  const host = isHost(match, userId)
  const ready = host ? match.host_ready : match.guest_ready
  const [shareNote, setShareNote] = useState<string | null>(null)
  const unlocked = useMemo(
    () => levels.filter((level) => isUnlocked(level, levels, progress)),
    [levels, progress],
  )
  const selected = levels.find((level) => level.id === match.rules.levelId)

  const shareInvite = async () => {
    playSound('button')
    setShareNote(null)
    const result = await shareDuelInvite({
      code: match.code,
      text: t('duelInviteText', { code: match.code }),
    })
    if (result === 'copied') setShareNote(t('duelInviteCopied'))
    else if (result === 'failed') setShareNote(t('duelInviteFailed'))
  }

  return (
    <Shell title={t('duelLobby')} onBack={onLeave}>
      <div className="duel-code-block">
        <p className="duel-code-label">{t('duelRoomCode')}</p>
        <p className="duel-code">{match.code}</p>
        <p className="duel-muted">{t('duelShareCode')}</p>
        <button
          type="button"
          className="btn-primary duel-share-btn"
          disabled={busy}
          onClick={() => {
            void shareInvite()
          }}
        >
          {t('duelShareInvite')}
        </button>
        {shareNote && <p className="duel-share-note">{shareNote}</p>}
      </div>

      <div className="duel-vs">
        <div className="duel-player">
          <span className="duel-player-role">{t('duelHost')}</span>
          <strong>{profileName(profiles, match.host_id)}</strong>
          <span data-ready={match.host_ready}>
            {match.host_ready ? t('duelReady') : t('duelNotReady')}
          </span>
        </div>
        <span className="duel-vs-mark">VS</span>
        <div className="duel-player">
          <span className="duel-player-role">{t('duelGuest')}</span>
          <strong>
            {match.guest_id
              ? profileName(profiles, match.guest_id)
              : t('duelWaitingOpponent')}
          </strong>
          <span data-ready={match.guest_ready}>
            {match.guest_id
              ? match.guest_ready
                ? t('duelReady')
                : t('duelNotReady')
              : '—'}
          </span>
        </div>
      </div>

      <PancitoPanel
        pose={match.guest_id ? 'point' : 'wait'}
        body={
          match.guest_id ? t('duelPancitoLobbyReady') : t('duelPancitoLobbyWait')
        }
      />

      {host ? (
        <label className="cloud-field">
          <span>{t('duelChooseLevel')}</span>
          <select
            value={match.rules.levelId}
            disabled={busy}
            onChange={(event) => {
              const levelId = event.target.value
              onError(null)
              setBusy(true)
              playSound('button')
              void updateMatchRules(match.id, { country, levelId })
                .catch((err) =>
                  onError(err instanceof Error ? err.message : t('duelError')),
                )
                .finally(() => setBusy(false))
            }}
          >
            <option value="">{t('duelPickLevel')}</option>
            {unlocked.map((level) => (
              <option key={level.id} value={level.id}>
                {t('level')} {level.numero}
                {level.dificil ? ` (${t('hard')})` : ''} ·{' '}
                {t('cardsCount', { n: level.cartas })}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="duel-level-line">
          {selected
            ? t('duelLevelSelected', { n: selected.numero })
            : t('duelHostPickingLevel')}
        </p>
      )}

      {error && (
        <p className="cloud-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="duel-actions">
        <button
          type="button"
          className="btn-secondary"
          disabled={busy || !match.rules.levelId || !match.guest_id}
          onClick={() => {
            onError(null)
            setBusy(true)
            playSound('button')
            void setReady(match, userId, !ready)
              .catch((err) =>
                onError(err instanceof Error ? err.message : t('duelError')),
              )
              .finally(() => setBusy(false))
          }}
        >
          {ready ? t('duelUnready') : t('duelReadyUp')}
        </button>
        {host && (
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !bothReady(match) || !match.rules.levelId}
            onClick={() => {
              onError(null)
              setBusy(true)
              playSound('button')
              void startCountdown(match.id)
                .catch((err) =>
                  onError(err instanceof Error ? err.message : t('duelError')),
                )
                .finally(() => setBusy(false))
            }}
          >
            {t('duelStart')}
          </button>
        )}
      </div>
      <p className="duel-muted">{t('duelRecord', {
        w: profile.wins,
        l: profile.losses,
        d: profile.draws,
      })}</p>
    </Shell>
  )
}

function DuelPlay({
  match,
  userId,
  onSubmitted,
  onForfeit,
}: {
  match: DuelMatch
  userId: string
  onSubmitted: () => Promise<void>
  onForfeit: () => Promise<void>
}) {
  const t = useT()
  const { cards, levels } = useContent()
  const level = levels.find((item) => item.id === match.rules.levelId)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const submitted = useRef(false)
  const playingMarked = useRef(false)

  const rules = useMemo(
    () => (level ? rulesFromLevel(level) : null),
    [level],
  )

  useEffect(() => {
    if (!match.starts_at) {
      setLive(true)
      return
    }
    const tick = () => {
      const left = Math.ceil((new Date(match.starts_at!).getTime() - Date.now()) / 1000)
      if (left <= 0) {
        setCountdown(0)
        setLive(true)
        if (isHost(match, userId) && !playingMarked.current) {
          playingMarked.current = true
          void markPlaying(match.id)
        }
        return
      }
      setCountdown(left)
      setLive(false)
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [match, userId])

  if (!level || !rules) {
    return (
      <Shell title={t('duel')} onBack={() => void onForfeit()}>
        <PancitoPanel pose="wait" body={t('duelLevelMissing')} />
      </Shell>
    )
  }

  if (!live) {
    return (
      <main className="screen screen-duel screen-duel-countdown" tabIndex={-1}>
        <PancitoSprite pose="point" className="duel-countdown-pancito" />
        <p className="duel-countdown-label">{t('duelPancitoCountdown')}</p>
        <p className="duel-countdown-number">{countdown ?? 3}</p>
      </main>
    )
  }

  return (
    <DuelBoard
      levelNumero={level.numero}
      rules={rules}
      deck={cards}
      onFinish={async (payload) => {
        if (submitted.current) return
        submitted.current = true
        await submitDuelResult(match.id, userId, payload)
        await onSubmitted()
      }}
      onForfeit={async () => {
        if (submitted.current) return
        submitted.current = true
        await onForfeit()
      }}
    />
  )
}

function DuelBoard({
  levelNumero,
  rules,
  deck,
  onFinish,
  onForfeit,
}: {
  levelNumero: number
  rules: ReturnType<typeof rulesFromLevel>
  deck: Parameters<typeof useMatch>[1]
  onFinish: (payload: {
    completed: boolean
    forfeited?: boolean
    durationMs: number
    mistakes: number
    stars: number
  }) => Promise<void>
  onForfeit: () => Promise<void>
}) {
  const t = useT()
  const match = useMatch(rules, deck)
  const { phase, result } = match
  const [confirmQuit, setConfirmQuit] = useState(false)
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    if (phase !== 'won' && phase !== 'lost') return
    if (!result) return
    sent.current = true
    playSound(phase === 'won' ? 'section' : 'button')
    void onFinish({
      completed: phase === 'won',
      durationMs: result.seconds * 1000,
      mistakes: result.mistakes,
      stars: result.stars,
    })
  }, [phase, result, onFinish])

  return (
    <main
      id="main-content"
      className="screen screen-game"
      data-cards={rules.cards}
      tabIndex={-1}
    >
      <MatchBar
        title={`${t('duel')} · ${t('level')} ${levelNumero}`}
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
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmQuit(true)}
          >
            {t('duelForfeit')}
          </button>
        </div>
      </Modal>

      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)}>
        <h2 className="modal-title">{t('duelForfeitTitle')}</h2>
        <p className="modal-text">{t('duelForfeitBody')}</p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              playSound('button')
              void onForfeit()
            }}
          >
            {t('duelForfeit')}
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

      <Modal open={phase === 'won' || phase === 'lost'}>
        <PancitoSprite pose="wait" className="duel-wait-sprite" />
        <h2 className="modal-title">{t('duelSubmitting')}</h2>
        <p className="modal-text">{t('duelPancitoJudging')}</p>
      </Modal>
    </main>
  )
}

function WaitingRoom({
  match,
  profile,
  profiles,
  onLeave,
}: {
  match: DuelMatch
  profile: DuelProfile
  profiles: DuelProfile[]
  onLeave: () => void
}) {
  const t = useT()
  const rival = opponentId(match, profile.user_id)

  return (
    <Shell title={t('duelWaitingTitle')} onBack={onLeave}>
      <PancitoPanel pose="wait" body={t('duelPancitoWaiting')} />
      <p className="duel-muted">
        {t('duelWaitingFor', { name: profileName(profiles, rival) })}
      </p>
      <p className="duel-code">{match.code}</p>
    </Shell>
  )
}

function VerdictRoom({
  match,
  userId,
  results,
  profiles,
  busy,
  onRematch,
  onLeaveRoom,
}: {
  match: DuelMatch
  userId: string
  results: DuelResult[]
  profiles: DuelProfile[]
  busy: boolean
  onRematch: () => void
  onLeaveRoom: () => void
}) {
  const t = useT()
  const mine = results.find((r) => r.user_id === userId)
  const theirs = results.find((r) => r.user_id !== userId)
  const won = match.winner_id === userId
  const lost = Boolean(match.winner_id && match.winner_id !== userId)
  const pose = match.is_draw ? 'guide' : won ? 'happy' : 'wait'
  const headline = match.is_draw
    ? t('duelDraw')
    : won
      ? t('duelYouWin')
      : lost
        ? t('duelYouLose')
        : t('duelFinished')
  const speech = match.is_draw
    ? t('duelPancitoDraw')
    : won
      ? t('duelPancitoWin')
      : t('duelPancitoLose')

  return (
    <Shell title={t('duelVerdict')} onBack={onLeaveRoom}>
      <div className="duel-verdict">
        <PancitoSprite pose={pose} className="duel-verdict-pancito" />
        <h2 className="modal-title">{headline}</h2>
        <p className="duel-pancito-text">{speech}</p>
        <p className="duel-muted">{t('duelStayInRoom', { code: match.code })}</p>
      </div>

      <div className="duel-result-grid">
        <ResultCard
          title={profileName(profiles, userId)}
          result={mine}
          highlight={won}
        />
        <ResultCard
          title={profileName(profiles, opponentId(match, userId))}
          result={theirs}
          highlight={lost}
        />
      </div>

      <div className="duel-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={busy}
          onClick={onRematch}
        >
          {t('duelRematch')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={onLeaveRoom}
        >
          {t('duelLeaveRoom')}
        </button>
      </div>
    </Shell>
  )
}

function ResultCard({
  title,
  result,
  highlight,
}: {
  title: string
  result: DuelResult | undefined
  highlight: boolean
}) {
  const t = useT()
  return (
    <div className="duel-result-card" data-highlight={highlight}>
      <h3>{title}</h3>
      {!result ? (
        <p className="duel-muted">—</p>
      ) : result.forfeited ? (
        <p>{t('duelForfeited')}</p>
      ) : (
        <>
          <Stars count={result.stars as StarCount} />
          <dl className="summary">
            <div>
              <dt>{t('yourTime')}</dt>
              <dd>{formatTime(Math.round(result.duration_ms / 1000))}</dd>
            </div>
            <div>
              <dt>{t('yourMistakes')}</dt>
              <dd>{result.mistakes}</dd>
            </div>
          </dl>
          <p className="duel-muted">
            {result.completed ? t('duelCompleted') : t('duelNotCompleted')}
          </p>
        </>
      )}
    </div>
  )
}
