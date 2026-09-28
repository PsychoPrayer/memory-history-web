import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for App Store / Play Store.
 *
 * iOS Bundle ID: com.pancitogames.memoryhistory (Unity / App Store).
 * Android applicationId: com.pancitogames.memoryhistory2 (live Play listing).
 * After `cap sync android`, run tools/patch-android-package.mjs (cap:android does it).
 */
const config: CapacitorConfig = {
  appId: 'com.pancitogames.memoryhistory',
  appName: 'Memory History',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#e8dcc0',
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#e8dcc0',
      launchAutoHide: true,
      showSpinner: false,
    },
  },
}

export default config
