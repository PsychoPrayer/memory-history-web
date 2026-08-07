import { useEffect } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import { ProveedorContenido } from './datos/contenido'
import { useGuardado } from './lib/almacen'
import {
  atenuarMusicaEnPartida,
  desbloquearAudio,
  reproducirMusica,
} from './lib/audio'
import { Intro } from './pantallas/Intro'
import { Menu } from './pantallas/Menu'
import { Niveles } from './pantallas/Niveles'
import { Juego } from './pantallas/Juego'
import { Historias } from './pantallas/Historias'
import { Ajustes } from './pantallas/Ajustes'
import { Tests } from './pantallas/Tests'
import { Quiz } from './pantallas/Quiz'
import { Logros } from './pantallas/Logros'
import { Libre } from './pantallas/Libre'

export default function App() {
  const pais = useGuardado((estado) => estado.ajustes.pais)

  // Los navegadores no dejan sonar nada hasta el primer gesto del usuario.
  useEffect(() => {
    const abrir = () => desbloquearAudio()
    window.addEventListener('pointerdown', abrir, { once: true })
    window.addEventListener('keydown', abrir, { once: true })
    return () => {
      window.removeEventListener('pointerdown', abrir)
      window.removeEventListener('keydown', abrir)
    }
  }, [])

  return (
    <BrowserRouter>
      <ProveedorContenido pais={pais} cargando={<Cargando />}>
        <MusicaDeFondo />
        <Routes>
          <Route path="/" element={<Intro />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/niveles" element={<Niveles />} />
          <Route path="/juego/:nivelId" element={<Juego />} />
          <Route path="/libre" element={<Libre />} />
          <Route path="/libre/partida" element={<Juego libre />} />
          <Route path="/historias" element={<Historias />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/quiz/:nivel" element={<Quiz />} />
          <Route path="/logros" element={<Logros />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </ProveedorContenido>
    </BrowserRouter>
  )
}

/** La intro tiene su propia pista; el resto del juego comparte una. */
function MusicaDeFondo() {
  const { pathname } = useLocation()
  const enPartida =
    pathname.startsWith('/juego/') || pathname === '/libre/partida'

  useEffect(() => {
    reproducirMusica(pathname === '/' ? 'intro' : 'juego')
    atenuarMusicaEnPartida(enPartida)
  }, [pathname, enPartida])

  return null
}

function Cargando() {
  return (
    <div className="pantalla-cargando">
      <span className="cargando-marca">Memory History</span>
    </div>
  )
}
