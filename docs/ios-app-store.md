# iOS (App Store) — Capacitor

This web remake ships as a native shell with [Capacitor](https://capacitorjs.com/).
The `ios/` project is already in the repo. **Signing, Simulator, and Archive still require a Mac with Xcode.**

## Store identity (matches Unity listing)

| Field | Value |
|-------|--------|
| Bundle ID | `com.pancitogames.memoryhistory` |
| App name | Memory History |
| Company | PancitoGames |
| Marketing version | `1.4.0` (Unity live was `1.3.0`) |
| Build | `8` (Unity live was `7` — must always increase) |

Same Bundle ID → same App Store listing. New version + higher build → update over Unity.

## On a Mac (first open)

```bash
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
```

In Xcode:

1. Target **App** → **Signing & Capabilities** → PancitoGames Team.
2. Confirm Bundle Identifier is `com.pancitogames.memoryhistory`.
3. Run on Simulator / device.
4. **Product → Archive** → upload to App Store Connect (existing Memory History app).

## Every web change

```bash
npm run cap:ios
```

Then Archive again (bump build number each upload).

## Notes

- Vite uses `base: './'` so assets load inside the native WebView.
- Do not leave a `server.url` live-reload IP in production config.
- Privacy labels: account / cloud save (Supabase) must match App Store Connect nutrition labels.
- Android Play package is `com.pancitogames.memoryhistory2` (legacy listing). iOS stays `com.pancitogames.memoryhistory`. `npm run cap:android` patches the Android id after sync.
