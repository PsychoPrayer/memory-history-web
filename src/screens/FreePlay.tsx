import { useNavigate } from 'react-router-dom'
import { Header } from '../components/Header'
import { DECKS, DECK_NAME, deckAvailable, useBacks } from '../data/content'
import { setFreeSettings, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useT } from '../lib/i18n'
import { formatTime } from '../lib/board'

const CARD_COUNTS = [12, 16, 20, 24, 28, 32, 40]
const TIME_LIMITS = [0, 60, 90, 120, 180, 300]

export function FreePlay() {
  const t = useT()
  const navigate = useNavigate()
  const free = useSave((state) => state.free)
  const backs = useBacks()

  return (
    <main id="main-content" className="screen screen-free" tabIndex={-1}>
      <Header title={t('freePlay')} />

      <section className="settings-group">
        <h2>{t('deck')}</h2>
        <div className="options-row">
          {DECKS.map((deck) => {
            const available = deckAvailable(deck)
            return (
              <button
                key={deck}
                type="button"
                className="tab"
                data-active={free.deck === deck}
                disabled={!available}
                title={available ? DECK_NAME[deck] : t('countryNotExported')}
                onClick={() => {
                  playSound('button')
                  setFreeSettings({ deck })
                }}
              >
                {DECK_NAME[deck]}
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-group">
        <h2>{t('cardCount')}</h2>
        <div className="options-row">
          {CARD_COUNTS.map((cards) => (
            <button
              key={cards}
              type="button"
              className="tab"
              data-active={free.cards === cards}
              onClick={() => {
                playSound('button')
                setFreeSettings({ cards })
              }}
            >
              {cards}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-group">
        <h2>{t('timeLimit')}</h2>
        <div className="options-row">
          {TIME_LIMITS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className="tab"
              data-active={free.seconds === seconds}
              onClick={() => {
                playSound('button')
                setFreeSettings({ seconds })
              }}
            >
              {seconds === 0 ? t('noLimit') : formatTime(seconds)}
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
            data-active={free.peek}
            onClick={() => {
              playSound('button')
              setFreeSettings({ peek: true })
            }}
          >
            {t('yes')}
          </button>
          <button
            type="button"
            className="tab"
            data-active={!free.peek}
            onClick={() => {
              playSound('button')
              setFreeSettings({ peek: false })
            }}
          >
            {t('no')}
          </button>
        </div>
      </section>

      {Object.keys(backs).length > 0 && (
        <section className="settings-group">
          <h2>{t('cardBack')}</h2>
          <div className="back-grid">
            <button
              type="button"
              className="back-tile back-tile-auto"
              data-active={free.back === null}
              onClick={() => {
                playSound('button')
                setFreeSettings({ back: null })
              }}
            >
              {t('sectionDefaultBack')}
            </button>
            {Object.entries(backs).map(([cards, url]) => (
              <button
                key={cards}
                type="button"
                className="back-tile"
                data-active={free.back === url}
                onClick={() => {
                  playSound('button')
                  setFreeSettings({ back: url })
                }}
              >
                <img src={url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        type="button"
        className="btn-primary btn-wide"
        disabled={!deckAvailable(free.deck)}
        onClick={() => {
          playSound('transition')
          navigate('/free/match')
        }}
      >
        {t('startMatch')}
      </button>
    </main>
  )
}
