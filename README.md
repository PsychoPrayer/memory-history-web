# Memory History — versión web

Reimplementación en React de **MemoryHistory2**, el proyecto de Unity. Mismo stack que
PresupuestoApp: **React 18 + Vite 5 + TypeScript**, CSS global con variables, sin
frameworks de estilos.

**Este repositorio es ahora la única fuente de verdad.** El contenido (cartas, niveles,
historias, preguntas, logros) se edita directamente en `src/content/<país>/*.json`, y
las imágenes y el audio en `public/`. El proyecto de Unity ya no se usa.

> No ejecutes `npm run exportar`, `npm run medios` ni `npm run contenido`: leen de Unity
> y sobrescribirían las correcciones hechas aquí (títulos, textos, imágenes nuevas).

Para cambiar una imagen de historia, guárdala en `public/imagenes/historias/` como WebP
(lado máximo 900 px, calidad 82) y apunta a ella el campo `imagen` de la historia.

## Puesta en marcha

```bash
npm install
npm run dev
```

El servidor queda en http://localhost:5173.

## Histórico: el puente con Unity

Así se generó el contenido inicial. Se conserva solo como referencia.

El proyecto Unity se busca por defecto en `C:/Users/TechP/memoryhistory2/MemoryHistory2`.
Se cambia con la variable de entorno `UNITY_PROJECT`.

| Comando | Qué hace |
| --- | --- |
| `npm run exportar` | Lee los `.asset` de Unity (YAML), resuelve los GUID de los `.meta` y escribe `src/contenido/ve/*.json` |
| `npm run medios` | Convierte los PNG a WebP en `public/imagenes/` y copia los MP3 a `public/audio/` |
| `npm run contenido` | Los dos anteriores, en orden |
| `npm run empaquetar` | Copia las imágenes ya convertidas a `empaquetado/` con nombres por id, listas para subir a Storage |
| `npm run ambiente` | Genera `public/audio/ambiente.wav`, la pista de fondo del juego |

Ambos aceptan `--pais=ES` o `--pais=EU` para los otros dos catálogos. El selector del
menú solo deja elegir los países cuyo JSON ya esté exportado.

### Estado de cada país en Unity

| País | Cartas | Niveles | Historias | Preguntas | Notas |
| --- | ---: | ---: | ---: | ---: | --- |
| Venezuela | 101 | 140 | 54 | 156 | Exportado. Historias 53–54 sin preguntas en el original |
| Estados Unidos | 95 | 140 | 54 | 162 | Exportado |
| España | 73 | 140 | 54 | 162 | Exportado (menos cartas que los otros) |
| Pancitolandia | 60 | — | — | — | Exportado: solo baraja de modo libre |

La base de España lista la carta 71 dos veces y deja fuera la 72, que sí está en disco.
El exportador descarta el duplicado y avisa de las dos cosas; arreglarlo de raíz es
tocar el proyecto de Unity.

En el build de Unity, Estados Unidos y España venían bloqueados en el menú
(`disableUSASelection` y `disableSpainSelection`). Aquí no: si el contenido está
exportado, se puede jugar.

Los originales pesan hasta 2346 píxeles de lado; en pantalla una carta ocupa 280 como
mucho, así que el paso de medios los reduce y los pasa a WebP. Con `--rehacer` se
regenera todo aunque ya exista.

## Qué hay implementado

**Pantallas** — intro con logos, menú con onboarding de idioma y condiciones, selección
de nivel por pestañas, partida, historias, tests, quiz, logros, configuración y
PancitoLandia (modo libre).

**Progresión** — 140 niveles repartidos en siete secciones (12, 16, 20, 24, 28, 32 y 40
cartas), cada una con diez normales y diez difíciles. Se abren en cadena. Las estrellas
(0–3) salen de los errores cometidos contra los umbrales de cada nivel.

**Historias y tests** — las historias se desbloquean al ganar el nivel que las tiene
como premio. Los cinco tests se abren cuando están abiertas sus historias y se ha
superado el anterior. Unity bloqueaba los tests 3, 4 y 5 con una bandera de release
aunque el progreso los tuviera abiertos; aquí manda solo el progreso.

**Audio** — los seis efectos de Unity se copian tal cual. Los que el original nunca
tuvo (acertar, fallar, estrella y el aviso de tiempo) se sintetizan con la Web Audio
API: son tonos cortos, no hay nada que descargar.

De música Unity solo empaquetaba dos pistas, y la de partida era propia de Venezuela;
las de España y Estados Unidos se descargaban en tiempo de ejecución de un servidor
que ya no responde. Aquí manda una sola pista de ambiente en `public/audio/ambiente.mp3`,
igual para los tres países. **Ese archivo no está en el repositorio**: hay que
descargarlo y dejarlo ahí. Mientras falte suena la pista de Unity como respaldo.

**Diseño** — libro antiguo de exploración, todo en CSS. Sin esquinas redondeadas, sin
degradados de botón y sin sombras flotantes: hojas, filetes dobles, capitulares y
tinta ferrogálica sobre papel crema. Las tipografías son IM Fell English, un revival
de la imprenta inglesa del XVII, y EB Garamond para los textos largos. Del arte de
Unity solo se usan las imágenes de contenido —cartas, historias y los siete reversos—;
el resto está dibujado.

**Idiomas** — español e inglés. Unity resolvía esto de tres maneras a la vez; aquí la
interfaz sale de un único diccionario tipado en `src/lib/i18n.ts` y el contenido
conserva sus dos versiones porque viene así del exportador.

## Guardado

Todo el progreso vive en `localStorage` bajo la clave `memoryhistory.guardado`, en un
único objeto con el progreso separado por país. Unity lo repartía en decenas de claves
sueltas de PlayerPrefs.

El progreso sigue en `localStorage`. Con Supabase configurado, `initCloudSync()` en
`src/lib/cloudSync.ts` sube el guardado al iniciar sesión y lo fusiona (mejores
estrellas, uniones de historias) entre nube y dispositivo.

### Supabase (cuentas + sync)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. En SQL Editor, ejecuta `supabase/schema.sql`.
3. Authentication → Providers → Email: déjalo activo y **desactiva “Confirm email”**.
   Los jugadores solo eligen usuario y contraseña; el juego los convierte en un
   correo interno `usuario@users.memoryhistory.app` que nunca recibe mensajes
   (dominio configurable con `VITE_USERNAME_EMAIL_DOMAIN`). Las cuentas antiguas
   con correo real siguen entrando escribiendo su correo en el campo de usuario.
4. Copia Project URL y anon key a `.env` (usa `.env.example` como plantilla):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

5. Para la clasificación del Desafío del día, ejecuta también `supabase/daily.sql`
   en el SQL Editor. Sin esa tabla el desafío funciona igual, solo sin clasificación.
6. Después ejecuta `supabase/accounts.sql`: códigos de recuperación, borrado de cuenta
   desde el juego y reportes de nombres en la clasificación.
7. En Vercel, añade las mismas variables de entorno y redeploy.
8. En el juego: Configuración → Cuenta en la nube.

Para moderar: los reportes están en la tabla `name_reports`. Con 3 reportes, las filas
del jugador en `daily_results` pasan a `hidden = true`; ponlas en `false` para restaurarlas.

### Web y app nativa

- `npm run build`: versión web (Vercel). Rutas absolutas y service worker para jugar
  sin conexión (`dist/sw.js`, generado desde `src/sw-template.js`).
- `npm run build:native` (lo usan `cap:sync`, `cap:ios`, `cap:android`): rutas relativas
  para Capacitor y sin service worker, porque la app ya lleva todos los archivos.
- `node tools/icons.mjs`: regenera los iconos de `public/icons/`.

## Estructura

```
src/
├── componentes/  Carta, Tablero, Estrellas, Modal, BarraPartida, Cabecera
├── pantallas/    Intro, Menu, Niveles, Juego, Historias, Tests, Quiz,
│                 Logros, Ajustes, Libre
├── datos/        carga del contenido exportado y reglas de progresión
├── lib/          guardado, idiomas, audio, tablero y hook de partida
├── contenido/    JSON del contenido de cada país (se edita aquí directamente)
├── index.css     todo el diseño
└── tipos.ts      tipos compartidos

herramientas/     exportar.mjs y medios.mjs
public/           imagenes/ y audio/ generados por el paso de medios
```

## Pendiente

- Pulido opcional de auth (OAuth).
