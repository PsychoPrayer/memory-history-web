import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MatchBar } from '../components/MatchBar'
import { Stars } from '../components/Stars'
import { Modal } from '../components/Modal'
import { Board } from '../components/Board'
import { PancitoCallout, PancitoSprite } from '../components/PancitoGuide'
import { ZoomButton, ImageViewer } from '../components/ImageViewer'
import { useDeck, useContent } from '../data/content'
import {
  isBeaten,
  sectionComplete,
  sectionPerfect,
  campaignPerfect,
  sectionsFrom,
} from '../data/progression'
import {
  markRewardShown,
  markSectionCelebrated,
  markTipSeen,
  progressFor,
  recordVictory,
  useSave,
} from '../lib/save'
import { playSound, playStarSound } from '../lib/audio'
import { useLanguage, useT } from '../lib/i18n'
import { formatTime } from '../lib/board'
import { rulesFromLevel, freeRules, useMatch } from '../lib/useMatch'
import type { CardCatalog, Story, Level } from '../types'

interface Props {
  free?: boolean
}

type ConfirmAction = 'quit' | 'restart' | null
type VictoryStep = 'result' | 'story' | 'section' | 'trophySection' | 'trophyCampaign'

export function Game({ free = false }: Props) {
  const { levelId } = useParams()
  const { cards, levels } = useContent()
  const freeSettings = useSave((state) => state.free)
  const timeAssist = useSave((state) => state.settings.timeAssist)
  const freeDeck = useDeck(freeSettings.deck)

  const level = useMemo(
    () => (free ? null : levels.find((l) => l.id === decodeURIComponent(levelId ?? ''))),
    [free, levels, levelId],
  )

  const rules = useMemo(() => {
    if (level) {
      const base = rulesFromLevel(level)
      if (base.seconds <= 0 || timeAssist === 'default') return base
      if (timeAssist === 'unlimited') return { ...base, seconds: 0 }
      return { ...base, seconds: Math.round(base.seconds * 1.5) }
    }
    const template = levels.find((other) => other.cartas === freeSettings.cards)
    return freeRules({
      cards: freeSettings.cards,
      columns: template?.columnas ?? 4,
      rows: template?.filas ?? freeSettings.cards / 4,
      seconds: freeSettings.seconds,
      peekSeconds: freeSettings.peek ? 2.5 : 0,
      back: freeSettings.back ?? template?.reverso ?? null,
    })
  }, [freeSettings, level, levels, timeAssist])

  if (!free && !level) return <LevelNotFound />
  if (free && !freeDeck) return null

  const key =
    level?.id ??
    `free-${freeSettings.deck}-${freeSettings.cards}-${freeSettings.seconds}`

  return (
    <Match
      key={key}
      matchKey={key}
      level={level ?? null}
      rules={rules}
      deck={free ? (freeDeck as CardCatalog[]) : cards}
    />
  )
}

function LevelNotFound() {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/levels', { replace: true })
  }, [navigate])
  return null
}

interface MatchProps {
  matchKey: string
  level: Level | null
  rules: ReturnType<typeof rulesFromLevel>
  deck: CardCatalog[]
}

function Match({ matchKey, level, rules, deck }: MatchProps) {
  const navigate = useNavigate()
  const t = useT()
  const language = useLanguage()
  const { levels, stories, sections } = useContent()

  const country = useSave((state) => state.settings.country)
  const tipsSeen = useSave((state) => state.settings.tipsSeen ?? [])
  const progress = useSave(() => progressFor(country))

  const match = useMatch(rules, deck)
  const { phase, result, pause, resume } = match

  const levelsExit = level ? '/levels' : '/free'
  const savedRef = useRef<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [victoryStep, setVictoryStep] = useState<VictoryStep | null>(null)
  const [sectionMessage, setSectionMessage] = useState<string | null>(null)
  const [newStory, setNewStory] = useState<Story | null>(null)
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null)
  const [pendingTrophySection, setPendingTrophySection] = useState(false)
  const [pendingTrophyCampaign, setPendingTrophyCampaign] = useState(false)

  const hardIntroOpen = Boolean(
    level?.dificil && !tipsSeen.includes('hard-mode-intro'),
  )

  useEffect(() => {
    if (!hardIntroOpen) return
    if (phase === 'playing' || phase === 'peek') pause()
  }, [hardIntroOpen, phase, pause])

  useEffect(() => {
    if (phase !== 'won' || !result) return
    if (savedRef.current === matchKey) return
    savedRef.current = matchKey

    playStarSound(result.stars)

    let story: Story | null = null
    let sectionText: string | null = null
    let trophySection = false
    let trophyCampaign = false

    if (level) {
      /* Replay: level already cleared — never re-award the story popup. */
      const firstClear = !isBeaten(progress, level.id)
      const previousStars = progress.levels[level.id]?.stars ?? 0

      recordVictory(country, level.id, {
        stars: result.stars,
        bestTime: result.seconds,
        fewestMistakes: result.mistakes,
      })

      if (firstClear && level.historiaPremio) {
        const found = stories.find((s) => s.id === level.historiaPremio)
        if (found && !progress.rewardsShown.includes(found.id)) {
          story = found
        }
      }

      const section = sectionsFrom(levels).find((s) => s.cards === level.cartas)
      const progressAfter = {
        ...progress,
        levels: {
          ...progress.levels,
          [level.id]: {
            stars: Math.max(previousStars, result.stars) as typeof result.stars,
            bestTime: result.seconds,
            fewestMistakes: result.mistakes,
          },
        },
      }
      if (
        firstClear &&
        section &&
        sectionComplete(section, progressAfter) &&
        !progress.sectionsCelebrated.includes(level.cartas)
      ) {
        const message = sections.find((s) => s.cartas === level.cartas)
        sectionText = message ? message[language] : t('sectionComplete')
        markSectionCelebrated(country, level.cartas)
      }

      const sectionTip = `trophy-section-${level.cartas}`
      if (
        section &&
        sectionPerfect(section, progressAfter) &&
        !tipsSeen.includes(sectionTip)
      ) {
        trophySection = true
      }
      if (
        campaignPerfect(levels, progressAfter) &&
        !tipsSeen.includes('trophy-campaign')
      ) {
        trophyCampaign = true
      }
    }

    setNewStory(story)
    setSectionMessage(sectionText)
    setPendingTrophySection(trophySection)
    setPendingTrophyCampaign(trophyCampaign)
    setVictoryStep('result')
  }, [
    country,
    language,
    level,
    levels,
    matchKey,
    phase,
    progress,
    result,
    sections,
    stories,
    t,
    tipsSeen,
  ])

  useEffect(() => {
    if (phase === 'playing' || phase === 'peek') {
      savedRef.current = null
      setVictoryStep(null)
      setNewStory(null)
      setSectionMessage(null)
      setPendingTrophySection(false)
      setPendingTrophyCampaign(false)
      setConfirmAction(null)
    }
    if (phase === 'lost') {
      setVictoryStep(null)
      setNewStory(null)
      setSectionMessage(null)
      setPendingTrophySection(false)
      setPendingTrophyCampaign(false)
    }
  }, [phase])

  const next = level
    ? levels.find((other) => other.numero === level.numero + 1)
    : undefined

  const dismissPendingStory = () => {
    if (newStory) markRewardShown(country, newStory.id)
  }

  const advanceToTrophiesOrDone = () => {
    if (pendingTrophySection) {
      playSound('section')
      setVictoryStep('trophySection')
      return
    }
    if (pendingTrophyCampaign) {
      playSound('section')
      setVictoryStep('trophyCampaign')
      return
    }
    setVictoryStep(null)
  }

  const advanceFromResult = () => {
    markTipSeen('victory-first')
    if (newStory) {
      playSound('transition')
      setVictoryStep('story')
      return
    }
    if (sectionMessage) {
      playSound('section')
      setVictoryStep('section')
      return
    }
    advanceToTrophiesOrDone()
  }

  const advanceFromStory = () => {
    markTipSeen('first-story')
    if (newStory) markRewardShown(country, newStory.id)
    if (sectionMessage) {
      playSound('section')
      setVictoryStep('section')
      return
    }
    advanceToTrophiesOrDone()
  }

  const advanceFromSection = () => {
    advanceToTrophiesOrDone()
  }

  const advanceFromTrophySection = () => {
    if (level) markTipSeen(`trophy-section-${level.cartas}`)
    setPendingTrophySection(false)
    if (pendingTrophyCampaign) {
      playSound('section')
      setVictoryStep('trophyCampaign')
      return
    }
    setVictoryStep(null)
  }

  const advanceFromTrophyCampaign = () => {
    markTipSeen('trophy-campaign')
    setPendingTrophyCampaign(false)
    setVictoryStep(null)
  }

  const readStory = () => {
    markTipSeen('first-story')
    if (newStory) markRewardShown(country, newStory.id)
    navigate('/stories')
  }

  return (
    <main id="main-content" className="screen screen-game" data-cards={rules.cards} tabIndex={-1}>
      <MatchBar
        title={level ? `${t('level')} ${level.numero}` : t('freePlay')}
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

      {match.phase === 'playing' && !match.paused && (
        <div className="hint-dock">
          <button
            type="button"
            className="hint-pancito"
            disabled={match.hintUsed || match.pairsMade >= match.totalPairs}
            title={t('hintHelp')}
            aria-label={
              match.hintUsed ? t('hintUsed') : `${t('hintAsk')}. ${t('hintHelp')}`
            }
            onClick={() => {
              playSound('button')
              match.requestHint()
            }}
          >
            <PancitoSprite
              pose={match.hintUsed ? 'wait' : 'point'}
              className="hint-pancito-sprite"
            />
            <span className="hint-pancito-label">
              {match.hintUsed ? t('hintUsed') : t('hintAsk')}
            </span>
          </button>
        </div>
      )}

      {match.revealAll && <p className="peek-notice">{t('memorize')}</p>}

      <Modal
        open={hardIntroOpen}
        onClose={() => {
          markTipSeen('hard-mode-intro')
          resume()
        }}
      >
        <div className="hard-intro">
          <PancitoSprite pose="wait" className="hard-intro-sprite" />
          <h2 className="modal-title">{t('hardModeTitle')}</h2>
          <p className="modal-text">{t('hardModeBody')}</p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              playSound('button')
              markTipSeen('hard-mode-intro')
              resume()
            }}
          >
            {t('continue')}
          </button>
        </div>
      </Modal>

      <Modal
        open={
          match.paused &&
          !hardIntroOpen &&
          confirmAction === null &&
          match.phase === 'playing'
        }
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
            onClick={() => setConfirmAction('restart')}
          >
            {t('restart')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmAction('quit')}
          >
            {t('quit')}
          </button>
        </div>
      </Modal>

      <Modal open={confirmAction !== null} onClose={() => setConfirmAction(null)}>
        <h2 className="modal-title">{t('matchInProgress')}</h2>
        <p className="modal-text">
          {confirmAction === 'quit' ? t('confirmQuit') : t('confirmRestart')}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              if (confirmAction === 'quit') {
                navigate(levelsExit)
                return
              }
              match.resume()
              match.restart()
              setConfirmAction(null)
            }}
          >
            {confirmAction === 'quit' ? t('quit') : t('restart')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setConfirmAction(null)}
          >
            {t('cancel')}
          </button>
        </div>
      </Modal>

      <Modal open={phase === 'lost'}>
        {result && (
          <>
            <h2 className="modal-title">{t('defeat')}</h2>
            <p className="modal-praise">{t('nextTime')}</p>
            <dl className="summary">
              <div>
                <dt>{t('yourTime')}</dt>
                <dd>{formatTime(result.seconds)}</dd>
              </div>
              <div>
                <dt>{t('yourMistakes')}</dt>
                <dd>{result.mistakes}</dd>
              </div>
            </dl>
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={match.restart}>
                {t('tryAgain')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate(levelsExit)}
              >
                {t('toLevels')}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={phase === 'won' && victoryStep === 'result'}>
        {result && (
          <>
            <h2 className="modal-title">{t('victory')}</h2>
            {level && (
              <>
                <Stars count={result.stars} />
                <p className="modal-praise">{praise(result.stars, t)}</p>
              </>
            )}
            {level && (
              <PancitoCallout tipId="victory-first" textKey="tipVictory" pose="happy" />
            )}
            <dl className="summary">
              <div>
                <dt>{t('yourTime')}</dt>
                <dd>{formatTime(result.seconds)}</dd>
              </div>
              <div>
                <dt>{t('yourMistakes')}</dt>
                <dd>{result.mistakes}</dd>
              </div>
            </dl>
            <div className="modal-actions">
              {newStory || sectionMessage ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={advanceFromResult}
                >
                  {t('continue')}
                </button>
              ) : next ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    markTipSeen('victory-first')
                    navigate(`/game/${encodeURIComponent(next.id)}`)
                  }}
                >
                  {t('next')}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  markTipSeen('victory-first')
                  dismissPendingStory()
                  match.restart()
                }}
              >
                {t('improveScore')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  markTipSeen('victory-first')
                  dismissPendingStory()
                  navigate(levelsExit)
                }}
              >
                {t('toLevels')}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={victoryStep === 'story' && newStory !== null}>
        {newStory && (
          <div className="ex-libris">
            <p className="reward-title">{t('exLibris')}</p>
            {newStory.imagen && (
              <div className="plate plate-reward">
                <img className="detail-image" src={newStory.imagen} alt={newStory.titulo} />
                <span className="plate-corners" aria-hidden="true" />
                <ZoomButton onClick={() => setEnlargedImage(newStory.imagen)} />
              </div>
            )}
            <h2 className="modal-title">{t('newStory')}</h2>
            <p className="reward-name">{newStory.titulo}</p>
            {newStory[language].presentacion && (
              <p className="reward-intro">{newStory[language].presentacion}</p>
            )}
            <PancitoCallout tipId="first-story" textKey="tipFirstStory" pose="guide" />
            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={readStory}>
                {t('readStory')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={advanceFromStory}
              >
                {t('continueWithoutReading')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={victoryStep === 'section' && sectionMessage !== null}>
        <h2 className="modal-title">{t('sectionComplete')}</h2>
        <p className="modal-text-muted">{t('sectionCompleteFooter')}</p>
        <p className="modal-text">{sectionMessage}</p>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={advanceFromSection}>
            {t('continue')}
          </button>
        </div>
      </Modal>

      <Modal open={victoryStep === 'trophySection'}>
        <div className="trophy-modal">
          <span className="trophy-glyph" aria-hidden="true">
            ♛
          </span>
          <h2 className="modal-title">{t('trophySectionTitle')}</h2>
          <p className="modal-text">{t('trophySectionBody')}</p>
          <button type="button" className="btn-primary" onClick={advanceFromTrophySection}>
            {t('continue')}
          </button>
        </div>
      </Modal>

      <Modal open={victoryStep === 'trophyCampaign'}>
        <div className="trophy-modal">
          <span className="trophy-glyph trophy-glyph-master" aria-hidden="true">
            ★
          </span>
          <PancitoSprite pose="happy" className="trophy-pancito" />
          <h2 className="modal-title">{t('trophyCampaignTitle')}</h2>
          <p className="modal-text">{t('trophyCampaignBody')}</p>
          <button type="button" className="btn-primary" onClick={advanceFromTrophyCampaign}>
            {t('continue')}
          </button>
        </div>
      </Modal>

      <ImageViewer
        src={enlargedImage}
        alt={newStory?.titulo ?? ''}
        onClose={() => setEnlargedImage(null)}
      />

      <Modal
        open={
          phase === 'won' &&
          victoryStep === null &&
          savedRef.current === matchKey
        }
      >
        <h2 className="modal-title">{t('victory')}</h2>
        <div className="modal-actions">
          {next ? (
            <button
              type="button"
              className="btn-primary"
              onClick={() => navigate(`/game/${encodeURIComponent(next.id)}`)}
            >
              {t('next')}
            </button>
          ) : null}
          <button
            type="button"
            className={next ? 'btn-secondary' : 'btn-primary'}
            onClick={match.restart}
          >
            {t('improveScore')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(levelsExit)}
          >
            {t('toLevels')}
          </button>
        </div>
      </Modal>
    </main>
  )
}

function praise(stars: number, t: ReturnType<typeof useT>): string {
  if (stars === 3) return t('flawless')
  if (stars === 2) return t('wellDone')
  if (stars === 1) return t('justInTime')
  return t('byTheSkin')
}
