import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Native shell for App Store / Play Store.
 *
 * Bundle ID matches the live Unity listing (PancitoGames) so this build
 * replaces that app on App Store Connect / Play Console.
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
