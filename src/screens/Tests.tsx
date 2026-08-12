import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { useContent } from '../data/content'
import { unlockedStories, blockReason } from '../data/progression'
import { progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'

export function Tests() {
  const t = useT()
  const navigate = useNavigate()
  const { tests, stories, levels } = useContent()

  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))

  const unlocked = useMemo(
    () => unlockedStories(stories, levels, progress),
    [stories, levels, progress],
  )

  const perfectCount = tests.filter(
    (test) => (progress.tests[String(test.nivel)]?.bestScore ?? 0) >= 10,
  ).length
  const allTestsPerfect = tests.length > 0 && perfectCount >= tests.length

  return (
    <main id="main-content" className="screen screen-tests" tabIndex={-1}>
      <Header
        title={t('tests')}
        right={
          <span className="header-counter">
            {perfectCount}/{tests.length}
            {allTestsPerfect && (
              <span
                className="summary-trophy summary-trophy-stories"
                title={t('testsAllTrophy')}
                aria-label={t('testsAllTrophy')}
              >
                ♛
              </span>
            )}
          </span>
        }
      />

      <div className="test-list">
        {tests.map((test) => {
          const reason = blockReason(test, tests, unlocked, progress)
          const open = reason === null
          const record = progress.tests[String(test.nivel)]
          const perfect = (record?.bestScore ?? 0) >= 10

          return (
            <button
              key={test.nivel}
              type="button"
              className="test-tile"
              data-open={open}
              data-perfect={perfect || undefined}
              disabled={!open}
              onClick={() => {
                playSound('transition')
                navigate(`/quiz/${test.nivel}`)
              }}
            >
              <span className="test-tile-number">{test.nivel}</span>
              <span className="test-tile-body">
                <span className="test-tile-name">
                  {t('test')} {test.nivel}
                  {perfect && (
                    <span
                      className="summary-trophy"
                      title={t('testsPerfectTrophy')}
                      aria-label={t('testsPerfectTrophy')}
                    >
                      ♛
                    </span>
                  )}
                </span>
                <span className="test-tile-detail">
                  {t('stories')} {test.desdeHistoria}–{test.hastaHistoria}
                </span>
                {reason && (
                  <span className="test-tile-notice">
                    {reason.type === 'previousTest'
                      ? t('blockPreviousTest', { n: reason.level })
                      : reason.from === 1
                        ? t('blockFirstStories', { n: reason.to })
                        : t('blockStories', { a: reason.from, b: reason.to })}
                  </span>
                )}
              </span>
              {record?.completed && (
                <span className="test-tile-score">{record.bestScore}/10</span>
              )}
            </button>
          )
        })}
      </div>
    </main>
  )
}
