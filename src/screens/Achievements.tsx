import { useMemo, useState } from 'react'
import { Header } from '../components/Header'
import { Modal } from '../components/Modal'
import { useContent } from '../data/content'
import { achievementProgress, summarizePlayer } from '../data/progression'
import { progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useLanguage, useT } from '../lib/i18n'
import { useDailyStats } from '../lib/daily'
import type { Achievement } from '../types'

export function Achievements() {
  const t = useT()
  const language = useLanguage()
  const { achievements, levels, stories } = useContent()

  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))
  const dailyStats = useDailyStats()

  const summary = useMemo(
    () => summarizePlayer(levels, stories, progress, dailyStats),
    [stories, levels, progress, dailyStats],
  )

  const [open, setOpen] = useState<Achievement | null>(null)

  const earned = achievements.filter(
    (achievement) => achievementProgress(achievement, summary) >= achievement.objetivo,
  ).length

  return (
    <main id="main-content" className="screen screen-achievements" tabIndex={-1}>
      <Header
        title={t('achievements')}
        right={
          <span className="header-counter">
            {earned}/{achievements.length}
            {earned > 0 && earned >= achievements.length && (
              <span
                className="summary-trophy summary-trophy-stories"
                title={t('achievementsAllTrophy')}
                aria-label={t('achievementsAllTrophy')}
              >
                ♛
              </span>
            )}
          </span>
        }
      />

      <div className="achievement-grid">
        {achievements.map((achievement) => {
          const advance = Math.min(
            achievementProgress(achievement, summary),
            achievement.objetivo,
          )
          const earnedItem = advance >= achievement.objetivo

          return (
            <button
              key={achievement.id}
              type="button"
              className="achievement-tile"
              data-earned={earnedItem}
              onClick={() => {
                playSound('transition')
                setOpen(achievement)
              }}
            >
              {earnedItem && (
                <span
                  className="tile-trophy"
                  title={t('achievementsTrophy')}
                  aria-label={t('achievementsTrophy')}
                >
                  ♛
                </span>
              )}
              {achievement.icono ? (
                <img
                  src={achievement.icono}
                  alt={achievement[language].titulo}
                  loading="lazy"
                />
              ) : (
                <span className="achievement-tile-initial" aria-hidden="true">
                  {achievement[language].titulo.slice(0, 1)}
                </span>
              )}
              <span className="achievement-tile-name" aria-hidden={Boolean(achievement.icono)}>
                {achievement[language].titulo}
              </span>
              {achievement.conProgreso && !earnedItem && (
                <span className="progress-bar">
                  <span style={{ width: `${(advance / achievement.objetivo) * 100}%` }} />
                </span>
              )}
            </button>
          )
        })}
      </div>

      <Modal open={open !== null} onClose={() => setOpen(null)}>
        {open && (
          <>
            <h2 className="modal-title">{open[language].titulo}</h2>
            <p className="modal-text">{open[language].descripcion}</p>
            <p className="modal-text modal-text-muted">
              {t('achievementProgressLabel', {
                a: Math.min(achievementProgress(open, summary), open.objetivo),
                b: open.objetivo,
              })}
            </p>
            <button type="button" className="btn-primary" onClick={() => setOpen(null)}>
              {t('close')}
            </button>
          </>
        )}
      </Modal>
    </main>
  )
}
