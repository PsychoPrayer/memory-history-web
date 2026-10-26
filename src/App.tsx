import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  useLocation,
} from 'react-router-dom'
import { ContentProvider } from './data/content'
import { useSave } from './lib/save'
import {
  dimMusicInMatch,
  unlockAudio,
  playMusic,
  syncMuteToMusic,
} from './lib/audio'
import { LiveRegion } from './components/LiveRegion'
import { SkipLink } from './components/SkipLink'
import { ConnectionBanners } from './components/ConnectionBanners'
import { LoadingGate } from './components/LoadingGate'
import { PageTurnRoutes } from './components/PageTurn'
import { BookOpening } from './components/BookOpening'
import { initViewportRefit } from './lib/viewport'
import { initICloud } from './lib/icloud'
import { initAds } from './lib/ads'
import { Intro } from './screens/Intro'
import { Menu } from './screens/Menu'
import { Sections } from './screens/Sections'
import { Levels } from './screens/Levels'
import { Game } from './screens/Game'
import { Stories } from './screens/Stories'
import { Settings } from './screens/Settings'
import { Tests } from './screens/Tests'
import { Quiz } from './screens/Quiz'
import { Achievements } from './screens/Achievements'
import { FreePlay } from './screens/FreePlay'
import { Terms } from './screens/Terms'

export default function App() {
  const country = useSave((state) => state.settings.country)
  const language = useSave((state) => state.settings.language)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => initViewportRefit(), [])

  useEffect(() => initICloud(), [])

  useEffect(() => initAds(), [])

  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  return (
    <BrowserRouter>
      <ContentProvider country={country} loading={<Loading />}>
        <SkipLink />
        <LiveRegion />
        <BackgroundMusic />
        <ConnectionBanners />
        <PageTurnRoutes>
          <Route path="/" element={<Intro />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/levels" element={<Sections />} />
          <Route path="/levels/:cards" element={<LoadingGate label="loadingMap"><Levels /></LoadingGate>} />
          <Route path="/game/:levelId" element={<Game />} />
          <Route path="/free" element={<FreePlay />} />
          <Route path="/free/match" element={<Game free />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/quiz/:level" element={<LoadingGate label="loadingQuiz"><Quiz /></LoadingGate>} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </PageTurnRoutes>
        <BookOpening />
      </ContentProvider>
    </BrowserRouter>
  )
}

function BackgroundMusic() {
  const { pathname } = useLocation()
  const muted = useSave((state) => Boolean(state.settings.muted))
  const inMatch =
    pathname.startsWith('/game/') ||
    pathname === '/free/match'

  useEffect(() => {
    playMusic(pathname === '/' ? 'intro' : 'game')
    dimMusicInMatch(inMatch)
  }, [pathname, inMatch])

  useEffect(() => {
    syncMuteToMusic(muted)
  }, [muted])

  return null
}

function Loading() {
  return (
    <div className="screen-loading">
      <span className="loading-brand">Memory History</span>
    </div>
  )
}
