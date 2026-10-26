# Anuncios (Google AdMob)

Solo en las apps de Android e iOS; la web no tiene anuncios. El código está en
`src/lib/ads.ts`.

## Qué ve el jugador

- **Pista extra:** cuando ya usó la pista gratis de un nivel, la bombilla muestra un ▶.
  Al tocarla, el juego se pausa y pregunta si quiere ver un anuncio corto a cambio de
  otra pista (máximo una extra por intento). Si no lo ve hasta el final, no hay pista.
- **Anuncio a pantalla completa:** uno cada 4 partidas terminadas, al salir de la
  pantalla de resultado (siguiente nivel, reintentar o volver al mapa). Nunca durante
  una partida. Se cambia en `MATCHES_BETWEEN_INTERSTITIALS`.
- **Sin anuncios a pantalla completa para jugadores nuevos:** no aparecen hasta que
  el jugador gana los 10 niveles de la primera sección (Aprendiz) en algún país. Se
  cambia en `LEVELS_BEFORE_INTERSTITIALS`. El vídeo de la pista extra sí está
  disponible desde el principio, porque es opcional.

## Modo niños (siempre activo)

El juego es para todas las edades, así que todas las peticiones van marcadas como
dirigidas a niños:

- `tagForChildDirectedTreatment` y `tagForUnderAgeOfConsent` activados.
- Solo anuncios **G** (aptos para todos) y no personalizados (`npa`).
- Android: se elimina el permiso `AD_ID` (no se lee el identificador publicitario).
- iOS: no se pide permiso de rastreo (ATT).

## Pasos para activarlo de verdad

Ahora mismo usa los **identificadores de prueba de Google**: los anuncios que salen son
de prueba y no pagan.

1. Crea la cuenta en **admob.google.com** con la cuenta de Google de PancitoGames.
2. Añade dos apps: Android (`com.pancitogames.memoryhistory2`) e iOS
   (`com.pancitogames.memoryhistory`).
3. En cada app, en **Configuración de la app → Contenido para niños / COPPA**, marca que
   la app está dirigida a niños, y en **Bloqueo → Clasificación máxima** elige **G**.
4. Crea en cada app dos **bloques de anuncios**: "Bonificado" (pista extra) e
   "Intersticial".
5. Pásale a Claude los 6 identificadores (2 de app y 4 de bloques; no son secretos) para
   ponerlos en `src/lib/ads.ts`, `AndroidManifest.xml` e `Info.plist`, y poner
   `TESTING = false`.
6. **app-ads.txt:** AdMob te da una línea; hay que publicarla en
   `https://<dominio-de-la-web>/app-ads.txt` (en `public/app-ads.txt`) y poner ese
   dominio como web del desarrollador en Google Play y App Store.

## Tiendas

- **Google Play → Público objetivo:** incluye las franjas de niños (es lo honesto para
  este juego) y acepta la **Política de Familias**. AdMob está certificado para familias.
- **Google Play → Seguridad de los datos:** declara lo que recoge el SDK de AdMob
  (datos del dispositivo, diagnósticos e interacción con anuncios), sin identificador
  publicitario y sin compartir para publicidad personalizada.
- **Google Play → Contiene anuncios:** sí.
- **App Store → Privacidad:** declara los datos de AdMob ("Datos de uso / Publicidad",
  "Diagnóstico"), no vinculados a la identidad y no usados para rastrear. No pongas la
  app en la categoría Niños: esa categoría no permite anuncios de terceros.
- **Edad recomendada:** el cuestionario de cada tienda; los anuncios no la cambian,
  pero el alcohol de algunas cartas sí puede subirla.
