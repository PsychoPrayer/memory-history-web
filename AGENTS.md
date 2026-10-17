# ¡Bienvenido al equipo de Memory History! 👋

Hola, ChatGPT. Qué bueno tenerte con nosotros. Este archivo es tu guía para entrar al
proyecto: qué estamos construyendo, cómo está organizado y las reglas que seguimos para
que todos trabajemos igual. Léelo antes de tocar código y vuelve a él cuando dudes.

Trabajamos en equipo con Iván (el creador del juego) y con Claude. Habla con Iván en
español; el código, los comentarios y los mensajes de commit van en inglés.

---

## 1. Qué es Memory History

Un **juego de memoria educativo** sobre la historia y la cultura de distintos países,
de **PancitoGames**. Gratis y sin anuncios. Lo protagoniza **Pancito**, un panecillo
explorador que guía al jugador.

- **Países jugables:** Venezuela, España y Estados Unidos (70 niveles y 54 historias
  cada uno). **Italia** aparece como "Coming soon" en el selector; su contenido se está
  preparando.
- **Campaña:** 7 secciones por país (Aprendiz → Erudito, de 12 a 40 cartas). Cada
  sección es un mapa antiguo con 10 niveles (5 normales y 5 difíciles). Ganar niveles da
  estrellas (1–3) y desbloquea **historias ilustradas**.
- **Tests:** preguntas sobre las historias desbloqueadas.
- **Desafío del día:** el mismo tablero para todos cada día (UTC), solo cuenta el primer
  intento, cada error suma 3 s. Hay racha, pasaporte de sellos, clasificación y
  **avatares de premio** (solo los 5 Pancitos base son libres; los demás se ganan aquí).
- **PancitoLandia:** partida libre con una baraja de 59 Pancitos.
- **Duelos** en tiempo real entre jugadores.
- **Logros**, **pista** (bombilla, una por nivel) y **juego sin conexión**.
- **Cuentas opcionales** con usuario y contraseña (sin correo) y código de recuperación.

Se publica como **web** (Vercel) y como **app nativa** para App Store y Google Play
(Capacitor).

---

## 2. Stack

- **React 18 + TypeScript + Vite 5**, `react-router-dom` 6.
- **Supabase**: cuentas (Auth), guardado en la nube, duelos, clasificación del desafío,
  recuperación de cuentas y reportes.
- **Capacitor 8** para iOS y Android (`ios/`, `android/`).
- **Vercel** para la web: cada push a `main` se publica solo.
- Sin librerías de UI ni de estilos: **todo el CSS vive en `src/index.css`**.
- `sharp` en scripts de Node para imágenes e iconos.

---

## 3. Mapa del repositorio

```
src/
  screens/      Una pantalla por ruta: Menu, Sections (/levels), Levels (/levels/:cards,
                el mapa), Game, Daily, DailyGame, Stories, Tests, Quiz, Achievements,
                FreePlay, Duel, Settings, Terms, Intro
  components/   Piezas reutilizables: Board, Card, MatchBar, Modal, LoadingGate,
                CloudAccount, SyncChoice, AccountModals, AvatarPicker, PancitoGuide...
  lib/          Lógica: save (guardado local), cloudSync (Supabase + fusión de
                progreso), daily (desafío), useMatch (reglas de partida), i18n (textos
                ES/EN), offline (service worker), avatars, nameFilter, duel...
  data/         Carga del contenido por país y reglas de progresión
  content/      JSON del contenido de cada país (ve, es, eu, pl) y textos legales
  sw-template.js  Plantilla del service worker (la build genera dist/sw.js)
public/         imagenes/ (cartas, historias, atlas, banderas, ui), audio/, icons/
supabase/       SQL para el proyecto de Supabase
tools/          Scripts de Node (iconos, banderas, paquete Android)
docs/           Notas de publicación (ej. ios-app-store.md)
```

---

## 4. Cómo se trabaja

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # versión web (tsc + vite) — debe pasar siempre antes de un commit
npm run build:native   # versión para Capacitor (rutas relativas, sin service worker)
npm run cap:ios        # build nativa + sync + abre Xcode
npm run cap:android    # build nativa + sync + abre Android Studio
node tools/icons.mjs   # regenera los iconos de public/icons
```

- La **web** usa rutas absolutas (`/`) y service worker. La **app nativa** usa
  `--mode native` (rutas relativas, sin service worker). No mezcles las dos builds.
- Variables en `.env` (ver `.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## 5. Reglas del proyecto (importante)

### Contenido
- **Este repositorio es la única fuente del contenido.** El proyecto de Unity está
  abandonado. **Nunca ejecutes `npm run export`, `media` ni `content`**: leen de Unity y
  borrarían las correcciones hechas aquí.
- Las historias se editan en `src/content/<país>/stories.json`. Títulos en formato
  título: palabras con mayúscula y conectores (a, la, de, del, y, en…) en minúscula
  ("Pulpo a la Gallega"). Con tildes correctas.
- Imágenes de historia: WebP en `public/imagenes/historias/`, lado máximo 900 px,
  calidad 82; se apunta desde el campo `imagen`. Las cartas del tablero están en
  `public/imagenes/cartas/` y son otra cosa.

### Textos e idiomas
- Todo texto visible va en `src/lib/i18n.ts`, **siempre en español y en inglés**.
  Nada de textos sueltos en los componentes.
- Los términos y la privacidad están en `src/content/legal/terms-es.md` y `terms-en.md`.
  Si cambian las obligaciones del jugador, sube `TERMS_VERSION` en
  `src/content/legal/terms.ts` (así todos los aceptan de nuevo) y actualiza fecha y
  versión en ambos idiomas.

### Diseño
- Estética de **libro antiguo de exploración**: papel, tinta, cuero, oro; tipografías
  IM Fell English y EB Garamond. **Sin esquinas redondeadas** salvo medallas y cartas.
- Hay **profundidad**: botones y paneles con canto inferior, sombras en capas, se
  levantan al pasar el ratón y se hunden al pulsar. Usa los tokens de `:root`
  (`--cuero`, `--canto`, `--brillo`, `--sombra-elevada`…) en vez de valores nuevos.
- **Pensado primero para móvil** (prueba a 375 px de ancho): nada debe desbordar en
  horizontal.
- Respeta `prefers-reduced-motion` en toda animación.

### Datos y nube
- El progreso vive en `localStorage` (`lib/save.ts`) y se sincroniza con Supabase.
  Si añades un campo nuevo al guardado, contémplalo en `migrate()` (save.ts) y en
  `mergeSavedStates()` (mergeSave.ts).
- Al iniciar sesión con progresos distintos en dispositivo y cuenta, el jugador elige
  (combinar / cargar cuenta / conservar dispositivo). No subas nada mientras haya un
  conflicto pendiente.
- El filtro de nombres ofensivos está duplicado a propósito en `lib/nameFilter.ts` y en
  `public.name_is_blocked()` de `supabase/accounts.sql`: si cambias uno, cambia el otro.

### Tiendas
- **Nada de donaciones ni enlaces de pago externos** (Ko-fi, PayPal…): App Store y
  Google Play lo rechazan. Si algún día hay apoyo económico, será con las compras
  integradas de cada tienda.

### Supabase
- Los SQL de `supabase/` se ejecutan en el SQL Editor en este orden: `schema.sql`,
  `duel.sql` (+ `duel_avatar`, `duel_rematch`, `duel_score`), `daily.sql`,
  `accounts.sql`. Todos se pueden volver a ejecutar sin romper nada.
- En Authentication → Email, **"Confirm email" está desactivado** (las cuentas no
  tienen correo real). No lo cambies.
- Nunca pongas la `service_role` key en el código del juego.

---

## 6. Antes de dar algo por terminado

1. `npm run build` pasa sin errores.
2. Lo probaste en el navegador a tamaño móvil (y en inglés si tocaste textos).
3. Si tocaste contenido, el JSON sigue siendo válido.
4. Commit en inglés, claro y en presente ("Add…", "Fix…"). `main` publica en Vercel,
   así que **no hagas push sin el visto bueno de Iván**.

---

¡Eso es todo para empezar! Si algo no está claro o ves algo que se puede mejorar,
dilo: preferimos una pregunta a tiempo que un arreglo después. Bienvenido a bordo,
y que Pancito te guíe. 🍞🧭
