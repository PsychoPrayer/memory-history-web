import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { PlayerBadge } from '../components/AvatarPicker'
import { Board } from '../components/Board'
import { CloudAccount } from '../components/CloudAccount'
import { MatchBar } from '../components/MatchBar'
import { Modal } from '../components/Modal'
import { PancitoSprite } from '../components/PancitoGuide'
import { avatarById } from '../lib/avatars'
import {
  DECKS,
  DECK_NAME,
  deckAvailable,
  useBacks,
  useDeck,
} from '../data/content'
import { formatTime } from '../lib/board'
import {
  bothReady,
  createDuel,
  defaultDuelRules,
  DUEL_FREE_CARD_COUNTS,
  DUEL_PEEK_SECONDS,
  duelBoardSeed,
  duelErrorMessage,
  duelRulesComplete,
  fetchMatch,
  fetchMyProfile,
  fetchProfiles,
  fetchResults,
  forgetDuelRoom,
  forgetInviteCode,
  gridForDuelCards,
  isCampaignDuelPack,
  isDuelRoomResumable,
  isHost,
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
  rematchVotes,
  setReady,
  startCountdown,
  submitDuelResult,
  subscribeToMatch,
  syncDuelProfile,
  updateMatchRules,
  type DuelMatch,
  type DuelProfile,
  type DuelResult,
  type DuelRules,
} from '../lib/duel'
import { getCloudStatus, subscribeCloud } from '../lib/cloudSync'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import { setSetting, useSave } from '../lib/save'
import { shareDuelInvite } from '../lib/share'
import { isSupabaseConfigured } from '../lib/supabase'
import { duelScoreBreakdown } from '../lib/duelScore'
import { freeRules, useMatch } from '../lib/useMatch'
import type { FreeDeck } from '../types'

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
  const playerName = useSave((state) => state.settings.playerName)
  const avatarId = useSave((state) => state.settings.avatarId)
  const inviteJoinInFlight = useRef(false)

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

  const abortInviteJoin = () => {
    forgetInviteCode()
    inviteJoinInFlight.current = false
    setJoiningInvite(false)
    setJoinCode('')
    setHubMode('home')
    setError(null)
  }

  useEffect(() => {
    const pack = match?.rules.country
    if (!pack || !isCampaignDuelPack(pack)) return
    if (pack !== country) {
      setSetting('country', pack)
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

    const load = async () => {
      try {
        if (playerName.trim().length >= 2) {
          const synced = await syncDuelProfile(user, playerName, avatarId)
          if (!cancelled) setProfile(synced)
          return
        }
        const next = await fetchMyProfile(user.id)
        if (!cancelled) setProfile(next)
      } catch (err) {
        if (!cancelled) {
          setProfile(null)
          setError(duelErrorMessage(err, 'duelError'))
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.id, playerName, avatarId])

  /* Rejoin the same room after refresh / a short leave — not abandoned matches. */
  useEffect(() => {
    if (!user || !profile || match) return
    if (recalledInviteCode()) return
    const roomId = recalledDuelRoom()
    if (!roomId) return
    let cancelled = false
    void fetchMatch(roomId)
      .then(async (next) => {
        if (cancelled || !next) {
          forgetDuelRoom()
          return
        }
        const inRoom = next.host_id === user.id || next.guest_id === user.id
        if (!inRoom || next.status === 'cancelled') {
          forgetDuelRoom()
          return
        }
        if (!isDuelRoomResumable(next)) {
          forgetDuelRoom()
          /* Free the seat so the rival is not stuck in a ghost match. */
          if (
            next.status === 'playing' ||
            next.status === 'countdown' ||
            next.status === 'awaiting_results'
          ) {
            void leaveDuel(next.id).catch(() => undefined)
          }
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
    if (!user || !profile || match) return
    const code = recalledInviteCode()
    if (!code || inviteJoinInFlight.current) return

    let active = true
    inviteJoinInFlight.current = true
    setJoiningInvite(true)
    setError(null)

    const joinWithTimeout = Promise.race([
      joinDuel(code),
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('JOIN_TIMEOUT')), 8000)
      }),
    ])

    void joinWithTimeout
      .then((next) => {
        forgetInviteCode()
        rememberDuelRoom(next.id)
        if (active) setMatch(next)
      })
      .catch(() => {
        forgetInviteCode()
        if (!active) return
        setHubMode('home')
        setJoinCode('')
        setError(t('duelJoinFailed'))
      })
      .finally(() => {
        inviteJoinInFlight.current = false
        setJoiningInvite(false)
      })

    return () => {
      active = false
    }
  }, [user?.id, profile?.user_id, match?.id, t])

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
        const ids = [next.host_id, next.guest_id].filter(Boolean) as string[]
        const nextProfiles = await fetchProfiles(ids)
        if (cancelled) return
        setProfiles(nextProfiles)

        /* Fresh rounds must not keep previous results (blocks rematch UI). */
        if (
          next.status === 'lobby' ||
          next.status === 'countdown' ||
          next.status === 'playing'
        ) {
          setResults([])
          return
        }

        const nextResults = await fetchResults(next.id)
        if (!cancelled) setResults(nextResults)
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

  const rematchStarting = useRef(false)

  /* Both vote rematch → lobby (host can change deck/level, then ready-up). */
  useEffect(() => {
    if (!match || !user || match.status !== 'finished') {
      rematchStarting.current = false
      return
    }
    if (!bothReady(match) || rematchStarting.current) return
    rematchStarting.current = true
    setBusy(true)
    setError(null)
    void rematchDuel(match.id)
      .then((next) => {
        setResults([])
        setMatch(next)
        void fetchMyProfile(user.id).then(setProfile)
      })
      .catch((err) => {
        rematchStarting.current = false
        const message = duelErrorMessage(err, t('duelError'))
        if (
          message === 'REMATCH_SETUP_NEEDED' ||
          message === 'DUEL_SETUP_NEEDED' ||
          /rematch_duel|Could not find the function|schema cache/i.test(message)
        ) {
          setError(t('duelRematchSetupNeeded'))
        } else {
          setError(message)
        }
      })
      .finally(() => setBusy(false))
  }, [
    match?.id,
    match?.status,
    match?.host_ready,
    match?.guest_ready,
    user?.id,
    t,
  ])

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
    if (!match) abortInviteJoin()
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
          </>
        ) : (
          <PancitoPanel pose="guide" body={t('duelNeedLocalProfile')} />
        )}
        {error && error !== 'DUEL_SETUP_NEEDED' && (
          <p className="cloud-form-error" role="alert">
            {error === 'duelError' ? t('duelError') : error}
          </p>
        )}
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            playSound('transition')
            navigate('/menu')
          }}
        >
          {t('duelGoSetProfile')}
        </button>
      </Shell>
    )
  }

  if (!match) {
    if (joiningInvite) {
      return (
        <Shell
          title={t('duel')}
          onBack={() => {
            abortInviteJoin()
            playSound('transition')
            navigate('/menu')
          }}
        >
          <PancitoPanel pose="wait" body={t('duelJoiningInvite')} />
          <p className="duel-code">{joinCode || recalledInviteCode() || '…'}</p>
          <p className="duel-muted">{t('duelJoiningInviteHelp')}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              playSound('button')
              abortInviteJoin()
            }}
          >
            {t('duelCancelJoin')}
          </button>
        </Shell>
      )
    }

    return (
      <Shell title={t('duel')} onBack={goMenu}>
        <div className="duel-profile-card">
          <PlayerBadge name={playerName || profile.username} avatarId={avatarId} />
          <p className="duel-record">
            {t('duelRecord', {
              w: profile.wins,
              l: profile.losses,
              d: profile.draws,
            })}
          </p>
        </div>
        <p className="duel-intro">{t('duelIntro')}</p>

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
                void createDuel(user, defaultDuelRules(country))
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
    /* Only wait after submitting — never during a fresh countdown/play. */
    if (myResult && match.status === 'awaiting_results') {
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
    const votes = rematchVotes(match, user.id)
    return (
      <VerdictRoom
        match={match}
        userId={user.id}
        results={results}
        profiles={profiles}
        localName={playerName}
        localAvatarId={avatarId}
        busy={busy}
        error={error}
        onError={setError}
        setBusy={setBusy}
        iAmReady={votes.iAmReady}
        theyAreReady={votes.theyAreReady}
        onRematchVote={async () => {
          setBusy(true)
          setError(null)
          playSound('button')
          try {
            await setReady(match, user.id, !votes.iAmReady)
            await refreshMatch.current()
          } catch (err) {
            setError(duelErrorMessage(err, t('duelError')))
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
        <span className="duel-header-spacer" aria-hidden="true" />
      </header>
      <div className="duel-body">{children}</div>
    </main>
  )
}

function PancitoPanel({
  pose,
  body,
}: {
  pose: 'happy' | 'wait' | 'guide' | 'point' | 'defeated'
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

function profileAvatar(
  profiles: DuelProfile[],
  userId: string | null | undefined,
  fallbackId = 'ui:happy',
) {
  if (!userId) return avatarById(fallbackId)
  const id =
    profiles.find((p) => p.user_id === userId)?.avatar_id ?? fallbackId
  return avatarById(id)
}

function DuelPlayerCard({
  role,
  name,
  avatarId,
  readyLabel,
  ready,
}: {
  role: string
  name: string
  avatarId: string
  readyLabel: string
  ready: boolean
}) {
  const avatar = avatarById(avatarId)
  return (
    <div className="duel-player">
      <span className="duel-player-role">{role}</span>
      <img className="duel-player-avatar" src={avatar.image} alt="" draggable={false} />
      <strong>{name}</strong>
      <span data-ready={ready}>{readyLabel}</span>
    </div>
  )
}

function formatDuelPeekLabel(
  rules: DuelRules,
  t: (key: 'duelPeekOn' | 'duelPeekOff', vars?: Record<string, string | number>) => string,
) {
  if (!rules.peek) return t('duelPeekOff')
  return t('duelPeekOn', { n: rules.peekSeconds })
}

function DuelRulesSummary({ rules }: { rules: DuelRules }) {
  const t = useT()
  const deck = DECK_NAME[rules.country] ?? rules.country
  return (
    <p className="duel-level-line">
      {t('duelRulesSummary', {
        deck,
        cards: rules.cards,
        peek: formatDuelPeekLabel(rules, t),
        back: rules.back ? '✓' : t('duelBackDefault'),
      })}
    </p>
  )
}

function DuelRulesEditor({
  rules,
  disabled,
  onChange,
}: {
  rules: DuelRules
  disabled?: boolean
  onChange: (next: DuelRules) => void
}) {
  const t = useT()
  const backs = useBacks()

  return (
    <div className="duel-rules-editor">
      <section className="settings-group">
        <h2>{t('deck')}</h2>
        <div className="options-row">
          {DECKS.filter(deckAvailable).map((code) => (
            <button
              key={code}
              type="button"
              className="tab"
              data-active={rules.country === code}
              disabled={disabled}
              onClick={() => {
                if (rules.country === code) return
                onChange({ ...rules, country: code as FreeDeck })
              }}
            >
              {DECK_NAME[code]}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>{t('cardCount')}</h2>
        <div className="options-row">
          {DUEL_FREE_CARD_COUNTS.map((cards) => (
            <button
              key={cards}
              type="button"
              className="tab"
              data-active={rules.cards === cards}
              disabled={disabled}
              onClick={() => {
                if (rules.cards === cards) return
                onChange({ ...rules, cards })
              }}
            >
              {cards}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>{t('openingGlance')}</h2>
        <div className="options-row">
          <button
            type="button"
            className="tab"
            data-active={rules.peek}
            disabled={disabled}
            onClick={() => {
              if (rules.peek) return
              onChange({
                ...rules,
                peek: true,
                peekSeconds:
                  rules.peekSeconds > 0 ? rules.peekSeconds : 2.5,
              })
            }}
          >
            {t('yes')}
          </button>
          <button
            type="button"
            className="tab"
            data-active={!rules.peek}
            disabled={disabled}
            onClick={() => {
              if (!rules.peek) return
              onChange({ ...rules, peek: false, peekSeconds: 0 })
            }}
          >
            {t('no')}
          </button>
        </div>
      </section>

      {rules.peek && (
        <section className="settings-group">
          <h2>{t('duelPeekSeconds')}</h2>
          <div className="options-row">
            {DUEL_PEEK_SECONDS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                className="tab"
                data-active={rules.peekSeconds === seconds}
                disabled={disabled}
                onClick={() => {
                  if (rules.peekSeconds === seconds) return
                  onChange({ ...rules, peek: true, peekSeconds: seconds })
                }}
              >
                {seconds}s
              </button>
            ))}
          </div>
        </section>
      )}

      {Object.keys(backs).length > 0 && (
        <section className="settings-group">
          <h2>{t('cardBack')}</h2>
          <div className="back-grid">
            <button
              type="button"
              className="back-tile back-tile-auto"
              data-active={rules.back === null}
              disabled={disabled}
              onClick={() => {
                if (rules.back === null) return
                onChange({ ...rules, back: null })
              }}
            >
              {t('duelBackDefault')}
            </button>
            {Object.entries(backs).map(([key, url]) => (
              <button
                key={key}
                type="button"
                className="back-tile"
                data-active={rules.back === url}
                disabled={disabled}
                onClick={() => {
                  if (rules.back === url) return
                  onChange({ ...rules, back: url })
                }}
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
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
  const host = isHost(match, userId)
  const ready = host ? match.host_ready : match.guest_ready
  const localName = useSave((state) => state.settings.playerName)
  const localAvatar = useSave((state) => state.settings.avatarId)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const rulesReady = duelRulesComplete(match.rules)

  const patchRules = (next: DuelRules) => {
    onError(null)
    setBusy(true)
    playSound('button')
    void updateMatchRules(match.id, next)
      .catch((err) =>
        onError(err instanceof Error ? err.message : t('duelError')),
      )
      .finally(() => setBusy(false))
  }

  const hostName =
    match.host_id === userId
      ? localName || profile.username
      : profileName(profiles, match.host_id)
  const guestName = match.guest_id
    ? match.guest_id === userId
      ? localName || profile.username
      : profileName(profiles, match.guest_id)
    : t('duelWaitingOpponent')
  const hostAvatar =
    match.host_id === userId
      ? localAvatar
      : profileAvatar(profiles, match.host_id).id
  const guestAvatar =
    match.guest_id === userId
      ? localAvatar
      : profileAvatar(profiles, match.guest_id).id

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
        <DuelPlayerCard
          role={t('duelHost')}
          name={hostName}
          avatarId={hostAvatar}
          ready={match.host_ready}
          readyLabel={match.host_ready ? t('duelReady') : t('duelNotReady')}
        />
        <span className="duel-vs-mark">VS</span>
        <DuelPlayerCard
          role={t('duelGuest')}
          name={guestName}
          avatarId={guestAvatar}
          ready={match.guest_ready}
          readyLabel={
            match.guest_id
              ? match.guest_ready
                ? t('duelReady')
                : t('duelNotReady')
              : '—'
          }
        />
      </div>

      <PancitoPanel
        pose={match.guest_id ? 'point' : 'wait'}
        body={
          match.guest_id ? t('duelPancitoLobbyReady') : t('duelPancitoLobbyWait')
        }
      />

      <aside className="duel-score-rules" aria-label={t('duelScoreRulesTitle')}>
        <h3>{t('duelScoreRulesTitle')}</h3>
        <p>{t('duelScoreRulesBody')}</p>
        <p className="duel-score-example">{t('duelScoreExample')}</p>
      </aside>

      {host ? (
        <DuelRulesEditor
          rules={match.rules}
          disabled={busy}
          onChange={patchRules}
        />
      ) : (
        <DuelRulesSummary rules={match.rules} />
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
          disabled={busy || !rulesReady || !match.guest_id}
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
            disabled={busy || !bothReady(match) || !rulesReady}
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
      <div className="duel-profile-card duel-profile-card-compact">
        <PlayerBadge
          name={localName || profile.username}
          avatarId={localAvatar}
        />
        <p className="duel-record">
          {t('duelRecord', {
            w: profile.wins,
            l: profile.losses,
            d: profile.draws,
          })}
        </p>
      </div>
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
  const pack = match.rules.country
  const deckCards = useDeck(pack)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [live, setLive] = useState(false)
  const submitted = useRef(false)
  const playingMarked = useRef(false)

  const rules = useMemo(() => {
    if (!duelRulesComplete(match.rules)) return null
    const grid = gridForDuelCards(match.rules.cards)
    return freeRules({
      cards: match.rules.cards,
      columns: grid.columns,
      rows: grid.rows,
      seconds: 0,
      peekSeconds: match.rules.peek ? match.rules.peekSeconds : 0,
      back: match.rules.back,
    })
  }, [match.rules])

  const boardTitle = useMemo(() => {
    if (!duelRulesComplete(match.rules)) return t('duel')
    return `${t('duel')} · ${DECK_NAME[pack] ?? pack} · ${t('cardsCount', {
      n: match.rules.cards,
    })}`
  }, [match.rules, pack, t])

  useEffect(() => {
    const startsAt = match.starts_at
    const matchId = match.id
    const host = isHost(match, userId)

    if (!startsAt) {
      setLive(true)
      return
    }

    const tick = () => {
      const left = Math.ceil((new Date(startsAt).getTime() - Date.now()) / 1000)
      if (left <= 0) {
        setCountdown(0)
        setLive(true)
        if (host && !playingMarked.current) {
          playingMarked.current = true
          void markPlaying(matchId)
        }
        return
      }
      setCountdown(left)
      setLive(false)
    }
    tick()
    const id = window.setInterval(tick, 200)
    return () => window.clearInterval(id)
  }, [match.id, match.starts_at, match.host_id, userId])

  if (!deckCards) {
    return (
      <Shell title={t('duel')} onBack={() => void onForfeit()}>
        <PancitoPanel pose="wait" body={t('duelPancitoCountdown')} />
      </Shell>
    )
  }

  if (!rules || !deckCards.length) {
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
      title={boardTitle}
      rules={rules}
      deck={deckCards}
      seed={duelBoardSeed(match)}
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
  title,
  rules,
  deck,
  seed,
  onFinish,
  onForfeit,
}: {
  title: string
  rules: ReturnType<typeof freeRules>
  deck: Parameters<typeof useMatch>[1]
  seed: number
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
  const match = useMatch(rules, deck, { seed })
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
        title={title}
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
  localName,
  localAvatarId,
  busy,
  error,
  onError,
  setBusy,
  iAmReady,
  theyAreReady,
  onRematchVote,
  onLeaveRoom,
}: {
  match: DuelMatch
  userId: string
  results: DuelResult[]
  profiles: DuelProfile[]
  localName: string
  localAvatarId: string
  busy: boolean
  error: string | null
  onError: (value: string | null) => void
  setBusy: (value: boolean) => void
  iAmReady: boolean
  theyAreReady: boolean
  onRematchVote: () => void
  onLeaveRoom: () => void
}) {
  const t = useT()
  const host = isHost(match, userId)
  const mine = results.find((r) => r.user_id === userId)
  const theirs = results.find((r) => r.user_id !== userId)
  const rivalId = opponentId(match, userId)
  const won = match.winner_id === userId
  const lost = Boolean(match.winner_id && match.winner_id !== userId)
  const pose = match.is_draw ? 'guide' : won ? 'happy' : 'defeated'
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

  const rematchHint = iAmReady
    ? theyAreReady
      ? t('duelRematchStarting')
      : t('duelRematchWaitingRival')
    : theyAreReady
      ? t('duelRematchRivalWaiting')
      : t('duelRematchNeedBoth')

  const patchRules = (next: DuelRules) => {
    onError(null)
    setBusy(true)
    playSound('button')
    void updateMatchRules(match.id, next)
      .catch((err) =>
        onError(err instanceof Error ? err.message : t('duelError')),
      )
      .finally(() => setBusy(false))
  }

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
          title={localName || profileName(profiles, userId)}
          avatarId={localAvatarId}
          result={mine}
          highlight={won}
        />
        <ResultCard
          title={profileName(profiles, rivalId)}
          avatarId={profileAvatar(profiles, rivalId).id}
          result={theirs}
          highlight={lost}
        />
      </div>

      <section className="duel-next-rules" aria-label={t('duelRulesTitle')}>
        <h3>{t('duelRulesTitle')}</h3>
        <p className="duel-muted">{t('duelRulesHelp')}</p>
        {host ? (
          <DuelRulesEditor
            rules={match.rules}
            disabled={busy || (iAmReady && theyAreReady)}
            onChange={patchRules}
          />
        ) : (
          <DuelRulesSummary rules={match.rules} />
        )}
      </section>

      <p className="duel-rematch-status" data-ready={iAmReady && theyAreReady}>
        {rematchHint}
      </p>

      {error && (
        <p className="cloud-form-error" role="alert">
          {error}
        </p>
      )}

      <div className="duel-actions">
        <button
          type="button"
          className={iAmReady ? 'btn-secondary' : 'btn-primary'}
          disabled={busy || (iAmReady && theyAreReady)}
          onClick={onRematchVote}
        >
          {iAmReady ? t('duelRematchCancel') : t('duelRematch')}
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
  avatarId,
  result,
  highlight,
}: {
  title: string
  avatarId: string
  result: DuelResult | undefined
  highlight: boolean
}) {
  const t = useT()
  const avatar = avatarById(avatarId)
  const score = result
    ? duelScoreBreakdown({
        completed: result.completed,
        forfeited: result.forfeited,
        durationMs: result.duration_ms,
        mistakes: result.mistakes,
      })
    : null

  return (
    <div className="duel-result-card" data-highlight={highlight}>
      <div className="duel-result-head">
        <img src={avatar.image} alt="" draggable={false} />
        <h3>{title}</h3>
      </div>
      {!result ? (
        <p className="duel-muted">—</p>
      ) : result.forfeited ? (
        <p>{t('duelForfeited')}</p>
      ) : (
        <>
          <p className="duel-score-total">
            <span>{t('duelScore')}</span>
            <strong>
              {score?.eligible ? score.total : t('duelScoreIneligible')}
            </strong>
          </p>
          <dl className="summary duel-result-data">
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
