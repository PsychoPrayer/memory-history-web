import { useMemo, useState } from 'react'
import { Header } from '../components/Header'
import { Modal } from '../components/Modal'
import { ZoomButton, ImageViewer } from '../components/ImageViewer'
import { useContent } from '../data/content'
import { unlockedStories } from '../data/progression'
import { markStoryRead, progressFor, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { useLanguage, useT } from '../lib/i18n'
import { gameUrl, shareStoryLink } from '../lib/share'
import type { Story } from '../types'

export function Stories() {
  const t = useT()
  const language = useLanguage()
  const { stories, levels } = useContent()

  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))

  const unlocked = useMemo(
    () => unlockedStories(stories, levels, progress),
    [stories, levels, progress],
  )

  const [open, setOpen] = useState<Story | null>(null)
  const [page, setPage] = useState(0)
  const [enlarged, setEnlarged] = useState<string | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)

  const show = (story: Story) => {
    playSound('transition')
    setOpen(story)
    setPage(0)
    setShareNote(null)
    markStoryRead(country, story.id)
  }

  const pages = open ? open[language].texto : []

  const shareOpen = async () => {
    if (!open) return
    playSound('button')
    const result = await shareStoryLink({
      title: open.titulo,
      text: t('shareStoryText', { title: open.titulo }),
      url: gameUrl('/stories'),
    })
    if (result === 'copied') {
      setShareNote(t('shareCopied'))
      window.setTimeout(() => setShareNote(null), 2200)
    }
  }

  return (
    <main id="main-content" className="screen screen-stories" tabIndex={-1}>
      <Header
        title={t('stories')}
        right={
          <span className="header-counter">
            {t('storiesRead', { a: unlocked.size, b: stories.length })}
          </span>
        }
      />

      <div className="story-grid">
        {stories.map((story) => {
          const storyUnlocked = unlocked.has(story.id)
          const isNew = storyUnlocked && !progress.storiesRead.includes(story.id)

          return (
            <button
              key={story.id}
              type="button"
              className="story-tile"
              data-open={storyUnlocked}
              disabled={!storyUnlocked}
              title={storyUnlocked ? story.titulo : t('storyLocked')}
              onClick={() => show(story)}
            >
              <span className="story-tile-frame">
                {storyUnlocked && story.imagen ? (
                  <img
                    src={story.imagen}
                    alt={story.titulo}
                    loading="lazy"
                  />
                ) : (
                  <span className="tile-lock" aria-hidden="true" />
                )}
              </span>
              <span className="story-tile-name" aria-hidden={storyUnlocked}>
                {storyUnlocked ? story.titulo : '???'}
              </span>
              {isNew && <span className="badge-new">{t('storyNew')}</span>}
            </button>
          )
        })}
      </div>

      <Modal open={open !== null} onClose={() => setOpen(null)} width="wide">
        {open && (
          <article className="story-detail">
            {open.imagen && (
              <div className="plate">
                <img className="detail-image" src={open.imagen} alt={open.titulo} />
                <span className="plate-corners" aria-hidden="true" />
                <ZoomButton onClick={() => setEnlarged(open.imagen)} />
              </div>
            )}
            <h2 className="modal-title">{open.titulo}</h2>

            <div className="detail-text">
              {(pages[page] ?? '').split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            {pages.length > 1 && (
              <div className="pager">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  {page + 1} / {pages.length}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={page >= pages.length - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            )}

            <div className="modal-actions story-actions">
              <button type="button" className="btn-secondary" onClick={shareOpen}>
                {t('shareStory')}
              </button>
              <button type="button" className="btn-primary" onClick={() => setOpen(null)}>
                {t('close')}
              </button>
              {shareNote && (
                <p className="modal-text modal-text-muted share-note" role="status">
                  {shareNote}
                </p>
              )}
            </div>
          </article>
        )}
      </Modal>

      <ImageViewer
        src={enlarged}
        alt={open?.titulo ?? ''}
        onClose={() => setEnlarged(null)}
      />
    </main>
  )
}
