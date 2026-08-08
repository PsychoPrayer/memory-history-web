import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CardCatalog,
  MatchPhase,
  BoardTile,
  Level,
  FreeMatch,
  Result,
  ErrorThresholds,
} from '../types'
import { computeStars } from '../data/progression'
import { buildBoard } from './board'
import { playSound } from './audio'
import { announce } from './a11y'
import { translate, useLanguage } from './i18n'

const MATCH_DELAY = 380
const FAIL_MARK_DELAY = 460
const FAIL_FLIP_BACK_DELAY = 1100

export interface MatchRules {
  cards: number
  columns: number
  rows: number
  /** 0 means no limit: clock counts up. */
  seconds: number
  peekSeconds: number
  mistakes: ErrorThresholds
  back: string | null
}

export function rulesFromLevel(level: Level): MatchRules {
  return {
    cards: level.cartas,
    columns: level.columnas,
    rows: level.filas,
    seconds: level.segundos,
    peekSeconds: level.vistazoSeg,
    mistakes: level.errores,
    back: level.reverso,
  }
}

export function freeRules(config: FreeMatch): MatchRules {
  return {
    cards: config.cards,
    columns: config.columns,
    rows: config.rows,
    seconds: config.seconds,
    peekSeconds: config.peekSeconds,
    mistakes: { tres: 0, dos: 0, una: 0 },
    back: config.back,
  }
}

export function useMatch(rules: MatchRules, catalog: CardCatalog[]) {
  const language = useLanguage()
  const [tiles, setTiles] = useState(() => buildBoard(catalog, rules.cards))
  const [phase, setPhase] = useState<MatchPhase>(
    rules.peekSeconds > 0 ? 'peek' : 'playing',
  )
  const [paused, setPaused] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [comparing, setComparing] = useState(false)

  const timers = useRef<number[]>([])
  const lastWarning = useRef(Infinity)

  const noLimit = rules.seconds === 0
  const remaining = noLimit ? Infinity : Math.max(0, rules.seconds - elapsed)

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  const schedule = useCallback((action: () => void, ms: number) => {
    timers.current.push(window.setTimeout(action, ms))
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const restart = useCallback(() => {
    clearTimers()
    setTiles(buildBoard(catalog, rules.cards))
    setPhase(rules.peekSeconds > 0 ? 'peek' : 'playing')
    setPaused(false)
    setMistakes(0)
    setElapsed(0)
    setComparing(false)
    lastWarning.current = Infinity
  }, [catalog, clearTimers, rules.cards, rules.peekSeconds])

  useEffect(() => {
    if (phase !== 'peek') return
    const id = window.setTimeout(() => setPhase('playing'), rules.peekSeconds * 1000)
    return () => clearTimeout(id)
  }, [phase, rules.peekSeconds])

  useEffect(() => {
    if (phase !== 'playing' || paused) return
    const id = window.setInterval(() => setElapsed((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [phase, paused])

  useEffect(() => {
    if (phase !== 'playing' || paused || noLimit) return
    if (remaining <= 10 && remaining > 0 && remaining < lastWarning.current) {
      lastWarning.current = remaining
      playSound('urgency')
      if (remaining === 10 || remaining === 5) {
        announce(translate(language, 'timeRunningOut', { n: remaining }), 'assertive')
      }
    }
  }, [phase, paused, remaining, noLimit, language])

  useEffect(() => {
    if (phase !== 'playing' || noLimit) return
    if (remaining <= 0) {
      clearTimers()
      setPhase('lost')
      playSound('defeat')
      announce(translate(language, 'announcedDefeat'), 'assertive')
    }
  }, [phase, clearTimers, remaining, noLimit, language])

  useEffect(() => {
    if (phase !== 'playing') return
    if (tiles.length && tiles.every((tile) => tile.state === 'matched')) {
      setPhase('won')
      playSound('victory')
      announce(translate(language, 'announcedVictory'), 'assertive')
    }
  }, [phase, tiles, language])

  const flip = useCallback(
    (key: string) => {
      if (phase !== 'playing' || paused || comparing) return

      const picked = tiles.find((tile) => tile.key === key)
      if (!picked || picked.state !== 'hidden') return

      const open = tiles.filter((tile) => tile.state === 'flipped')
      if (open.length >= 2) return

      playSound('card')
      announce(translate(language, 'flippedCard', { name: picked.card.nombre }))
      setTiles(
        tiles.map((tile) =>
          tile.key === key ? { ...tile, state: 'flipped' as const } : tile,
        ),
      )
      if (open.length === 0) return

      const first = open[0]
      const inPlay = (tile: BoardTile) => tile.key === first.key || tile.key === key

      setComparing(true)

      if (first.card.id === picked.card.id) {
        schedule(() => {
          setTiles((current) =>
            current.map((t) => (inPlay(t) ? { ...t, state: 'matched' as const } : t)),
          )
          setComparing(false)
          playSound('match')
          announce(
            translate(language, 'pairMatched', { name: picked.card.nombre }),
          )
        }, MATCH_DELAY)
        return
      }

      setMistakes((value) => value + 1)
      playSound('miss')
      announce(translate(language, 'pairMissed'))

      schedule(() => {
        setTiles((current) =>
          current.map((t) => (inPlay(t) ? { ...t, state: 'failed' as const } : t)),
        )
      }, FAIL_MARK_DELAY)

      schedule(() => {
        setTiles((current) =>
          current.map((t) => (inPlay(t) ? { ...t, state: 'hidden' as const } : t)),
        )
        setComparing(false)
      }, FAIL_FLIP_BACK_DELAY)
    },
    [comparing, language, phase, paused, schedule, tiles],
  )

  const pairsMade = useMemo(
    () => tiles.filter((tile) => tile.state === 'matched').length / 2,
    [tiles],
  )

  const result: Result | null = useMemo(() => {
    if (phase !== 'won' && phase !== 'lost') return null
    return {
      stars: phase === 'won' ? computeStars(mistakes, rules.mistakes) : 0,
      seconds: elapsed,
      mistakes,
    }
  }, [elapsed, mistakes, phase, rules.mistakes])

  const pause = useCallback(() => {
    setPaused(true)
    announce(translate(language, 'announcedPaused'))
  }, [language])

  const resume = useCallback(() => {
    setPaused(false)
    announce(translate(language, 'announcedResumed'))
  }, [language])

  return {
    tiles,
    phase,
    paused,
    mistakes,
    elapsed,
    remaining,
    noLimit,
    revealAll: phase === 'peek',
    pairsMade,
    totalPairs: rules.cards / 2,
    result,
    flip,
    restart,
    pause,
    resume,
  }
}
