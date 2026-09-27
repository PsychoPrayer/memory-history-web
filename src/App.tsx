import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { ContentProvider } from './data/content'
import { useSave } from './lib/save'
import { initCloudSync } from './lib/cloudSync'
import {
  dimMusicInMatch,
  unlockAudio,
  playMusic,
  syncMuteToMusic,
} from './lib/audio'
import { LiveRegion } from './components/LiveRegion'
import { SkipLink } from './components/SkipLink'
import { SyncChoice } from './components/SyncChoice'
import { initViewportRefit } from './lib/viewport'
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
import { Duel } from './screens/Duel'
import { Daily } from './screens/Daily'
import { DailyGame } from './screens/DailyGame'

export default function App() {
  const country = useSave((state) => state.settings.country)
  const language = useSave((state) => state.settings.language)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  useEffect(() => initCloudSync(), [])

  useEffect(() => initViewportRefit(), [])

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
        <SyncChoice />
        <Routes>
          <Route path="/" element={<Intro />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/levels" element={<Sections />} />
          <Route path="/levels/:cards" element={<Levels />} />
          <Route path="/game/:levelId" element={<Game />} />
          <Route path="/free" element={<FreePlay />} />
          <Route path="/free/match" element={<Game free />} />
          <Route path="/stories" element={<Stories />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/quiz/:level" element={<Quiz />} />
          <Route path="/achievements" element={<Achievements />} />
          <Route path="/duel" element={<Duel />} />
          <Route path="/daily" element={<Daily />} />
          <Route path="/daily/play" element={<DailyGame />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </ContentProvider>
    </BrowserRouter>
  )
}

function BackgroundMusic() {
  const { pathname } = useLocation()
  const muted = useSave((state) => Boolean(state.settings.muted))
  const inMatch =
    pathname.startsWith('/game/') ||
    pathname === '/free/match' ||
    pathname === '/daily/play'

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
