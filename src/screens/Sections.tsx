import { useMemo, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { STAR_TIP } from '../components/Stars'
import { useContent } from '../data/content'
import {
  campaignPerfect,
  isSectionUnlocked,
  nextMissionId,
  sectionPerfect,
  sectionStats,
  sectionsFrom,
  totalStars,
} from '../data/progression'
import { progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT, type TextKey } from '../lib/i18n'

function sectionKey(cards: number): TextKey {
  return `section${cards}` as TextKey
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/** Campaign sections as bound volumes; each opens its atlas map. */
export function Sections() {
  const t = useT()
  const navigate = useNavigate()
  const { levels, sections: sectionArt } = useContent()
  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))

  const sections = useMemo(() => sectionsFrom(levels), [levels])
  const next = useMemo(() => nextMissionId(levels, progress), [levels, progress])
  const nextCards = levels.find((level) => level.id === next)?.cartas
  const earned = totalStars(progress)
  const master = campaignPerfect(levels, progress)

  return (
    <main id="main-content" className="screen screen-sections" tabIndex={-1}>
      <Header
        title={t('levels')}
        right={
          <span className="header-counter" aria-label={`${t('stars')}: ${earned}`}>
            <svg className="header-star" viewBox="0 0 24 24" aria-hidden="true">
              <path d={STAR_TIP} />
            </svg>
            {earned}
            {master && <span className="summary-trophy" aria-hidden="true">★</span>}
          </span>
        }
      />

      <p className="sections-help">{t('sectionsHelp')}</p>

      <ol className="volume-grid">
        {sections.map((section, index) => {
          const open = isSectionUnlocked(index, sections, progress)
          const stats = sectionStats(section, progress)
          const perfect = open && sectionPerfect(section, progress)
          const done = stats.missionsDone === stats.missionsTotal
          const isNext = open && section.cards === nextCards
          const name = t(sectionKey(section.cards))
          const art = sectionArt.find((s) => s.cartas === section.cards)?.imagen
          const previous = sections[index - 1]
          const left = stats.missionsTotal - stats.missionsDone

          const label = open
            ? [
                name,
                t('cardsCount', { n: section.cards }),
                t('missionsDone', { a: stats.missionsDone, b: stats.missionsTotal }),
                `${t('stars')} ${t('starsOf', { a: stats.stars, b: stats.starsTotal })}`,
                isNext ? t('nextMission') : '',
                perfect ? t('sectionTrophy') : '',
              ]
                .filter(Boolean)
                .join('. ')
            : `${name}. ${t('sectionUnlockAfter', {
                name: previous ? t(sectionKey(previous.cards)) : '',
              })}`

          return (
            <li
              key={section.cards}
              className="volume-slot"
              style={{ '--i': index } as CSSProperties}
            >
              <button
                type="button"
                className="volume"
                data-open={open}
                data-next={isNext || undefined}
                data-done={(open && done) || undefined}
                data-perfect={perfect || undefined}
                disabled={!open}
                aria-label={label}
                onClick={() => {
                  playSound('transition')
                  navigate(`/levels/${section.cards}`)
                }}
              >
                <span className="volume-art" aria-hidden="true">
                  {art && <img src={art} alt="" draggable={false} loading="lazy" />}
                  <span className="volume-numeral">{ROMAN[index] ?? index + 1}</span>
                  {isNext && <span className="volume-ribbon">{t('nextMission')}</span>}
                  {perfect && <span className="volume-seal">♛</span>}
                  {!open && (
                    <span className="volume-lock">
                      <span className="volume-lock-icon" />
                    </span>
                  )}
                </span>

                <span className="volume-body" aria-hidden="true">
                  <span className="volume-name">{name}</span>
                  <span className="volume-meta">{t('cardsCount', { n: section.cards })}</span>

                  {open ? (
                    <>
                      <span className="volume-stats">
                        <span className="volume-stat">
                          <span className="volume-stat-label">{t('missions')}</span>
                          <span className="volume-stat-value">
                            {stats.missionsDone}
                            <small>/{stats.missionsTotal}</small>
                          </span>
                        </span>
                        <span className="volume-stat">
                          <span className="volume-stat-label">{t('stars')}</span>
                          <span className="volume-stat-value volume-stat-stars">
                            <svg viewBox="0 0 24 24">
                              <path d={STAR_TIP} />
                            </svg>
                            {stats.stars}
                            <small>/{stats.starsTotal}</small>
                          </span>
                        </span>
                      </span>
                      <span
                        className="volume-progress"
                        style={
                          {
                            '--done': stats.missionsDone / stats.missionsTotal,
                          } as CSSProperties
                        }
                      />
                      <span className="volume-left">
                        {done
                          ? t('sectionAllDone')
                          : t('atlasRemaining', { n: left })}
                      </span>
                    </>
                  ) : (
                    <span className="volume-locked-note">
                      {t('sectionUnlockAfter', {
                        name: previous ? t(sectionKey(previous.cards)) : '',
                      })}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </main>
  )
}
