import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { Modal } from '../components/Modal'
import { ZoomButton, ImageViewer } from '../components/ImageViewer'
import { useContent } from '../data/content'
import { progressFor, recordTest, useSave } from '../lib/save'
import { playSound } from '../lib/audio'
import { shuffle } from '../lib/board'
import { useLanguage, useT } from '../lib/i18n'

const ANSWER_DELAY = 950

export function Quiz() {
  const { level } = useParams()
  const navigate = useNavigate()
  const t = useT()
  const language = useLanguage()
  const { tests, questions, stories } = useContent()

  const country = useSave((state) => state.settings.country)
  const progress = useSave(() => progressFor(country))

  const test = tests.find((other) => other.nivel === Number(level))

  const [attempt, setAttempt] = useState(0)
  const [index, setIndex] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [finished, setFinished] = useState(false)
  const [enlarged, setEnlarged] = useState<string | null>(null)
  const savedRef = useRef(false)

  const batch = useMemo(() => {
    if (!test) return []
    const inRange = questions.filter((question) => {
      const number = Number(question.historia)
      return number >= test.desdeHistoria && number <= test.hastaHistoria
    })
    return shuffle(inRange).slice(0, test.preguntas)
  }, [attempt, questions, test])

  useEffect(() => {
    if (!test) navigate('/tests', { replace: true })
  }, [navigate, test])

  const score = batch.length
    ? Math.min(10, Math.max(1, Math.round((correct / batch.length) * 10)))
    : 0

  useEffect(() => {
    if (!finished || !test || savedRef.current) return
    savedRef.current = true
    recordTest(country, test.nivel, score)
  }, [country, finished, score, test])

  if (!test || batch.length === 0) return null

  const question = batch[index]
  const story = stories.find((entry) => entry.id === question.historia)
  const prompt = question[language].enunciado || question.es.enunciado
  const options = question[language].opciones.length
    ? question[language].opciones
    : question.es.opciones

  const answer = (option: number) => {
    if (picked !== null) return
    setPicked(option)

    const right = option === question.correcta
    if (right) setCorrect((value) => value + 1)
    playSound(right ? 'match' : 'miss')

    window.setTimeout(() => {
      setPicked(null)
      if (index + 1 < batch.length) setIndex(index + 1)
      else setFinished(true)
    }, ANSWER_DELAY)
  }

  const retry = () => {
    savedRef.current = false
    setAttempt((value) => value + 1)
    setIndex(0)
    setCorrect(0)
    setPicked(null)
    setFinished(false)
  }

  return (
    <main id="main-content" className="screen screen-quiz" tabIndex={-1}>
      <Header
        title={`${t('test')} ${test.nivel}`}
        backTo="/tests"
        right={
          <span className="header-counter">
            {t('questionOf', { a: index + 1, b: batch.length })}
          </span>
        }
      />

      <article className="question-sheet">
        {story?.imagen && (
          <div className="question-visual">
            <div className="plate plate-question">
              <img
                className="detail-image"
                src={story.imagen}
                alt={story.titulo}
              />
              <span className="plate-corners" aria-hidden="true" />
              <ZoomButton onClick={() => setEnlarged(story.imagen)} />
            </div>
            <p className="question-story-label">
              {t('aboutThisStory', { title: story.titulo })}
            </p>
          </div>
        )}

        <h2 className="question-prompt">{prompt}</h2>

        <div className="option-list">
          {options.map((option, position) => {
            const revealed = picked !== null
            const isCorrect = position === question.correcta
            const state = !revealed
              ? 'neutral'
              : isCorrect
                ? 'correct'
                : position === picked
                  ? 'incorrect'
                  : 'neutral'

            return (
              <button
                key={position}
                type="button"
                className="option"
                data-state={state}
                disabled={revealed}
                onClick={() => answer(position)}
              >
                <span className="option-letter">
                  {String.fromCharCode(65 + position)}
                </span>
                {option}
              </button>
            )
          })}
        </div>
      </article>

      <Modal open={finished}>
        <h2 className="modal-title">{t('yourScore')}</h2>
        <p className="quiz-score">
          {score}
          <span>/10</span>
        </p>
        <p className="modal-text">{scoreMessage(score, t)}</p>
        <p className="modal-text modal-text-muted">
          {correct} / {batch.length}
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-primary" onClick={retry}>
            {t('tryAgain')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/tests')}
          >
            {t('back')}
          </button>
        </div>
        {progress.tests[String(test.nivel)] && (
          <p className="modal-text modal-text-muted">{t('testCompleted')}</p>
        )}
      </Modal>

      <ImageViewer
        src={enlarged}
        alt={story?.titulo ?? ''}
        onClose={() => setEnlarged(null)}
      />
    </main>
  )
}

function scoreMessage(score: number, t: ReturnType<typeof useT>): string {
  if (score === 10) return t('scorePerfect')
  if (score >= 7) return t('scoreHigh')
  if (score >= 4) return t('scoreMedium')
  return t('scoreLow')
}
