import { Capacitor, type PluginListenerHandle } from '@capacitor/core'
import {
  AdMob,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  RewardAdPluginEvents,
} from '@capacitor-community/admob'
import { readState } from './save'

/**
 * Google AdMob, only in the Android and iOS apps (the web has no ads).
 *
 * The game is for all ages, so every request is child-directed: no
 * personalised ads, no advertising ID, no tracking prompt, and only ads rated
 * G (general audiences). See docs/anuncios.md.
 */

/**
 * Google's public test units. Replace them with the real ones from the AdMob
 * console before publishing (and the app IDs in AndroidManifest.xml and
 * Info.plist), then set TESTING to false.
 */
const TESTING = true

const UNITS = {
  android: {
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
  ios: {
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
} as const

/** A full-screen ad after this many finished matches, never in the middle of one. */
const MATCHES_BETWEEN_INTERSTITIALS = 4

/**
 * New players see no full-screen ads until they have won this many levels of
 * the first section (Aprendiz, 12 cards), in any country. Rewarded videos stay
 * available because the player chooses them.
 */
const LEVELS_BEFORE_INTERSTITIALS = 10

function finishedFirstSection(): boolean {
  let won = 0
  for (const progress of Object.values(readState().countries)) {
    for (const [levelId, record] of Object.entries(progress.levels)) {
      if (levelId.startsWith('12_') && record.stars > 0) won += 1
    }
  }
  return won >= LEVELS_BEFORE_INTERSTITIALS
}

type Platform = keyof typeof UNITS

let ready = false
let rewardedLoaded = false
let interstitialLoaded = false
let matchesSinceInterstitial = 0

function platform(): Platform | null {
  const name = Capacitor.getPlatform()
  return name === 'android' || name === 'ios' ? name : null
}

function adOptions(unit: 'rewarded' | 'interstitial') {
  return { adId: UNITS[platform()!][unit], isTesting: TESTING, npa: true }
}

function loadRewarded() {
  if (!ready || rewardedLoaded) return
  AdMob.prepareRewardVideoAd(adOptions('rewarded'))
    .then(() => {
      rewardedLoaded = true
    })
    .catch(() => undefined)
}

function loadInterstitial() {
  if (!ready || interstitialLoaded) return
  AdMob.prepareInterstitial(adOptions('interstitial'))
    .then(() => {
      interstitialLoaded = true
    })
    .catch(() => undefined)
}

/** Call once from App. Does nothing on the web. */
export function initAds() {
  if (!platform()) return
  AdMob.initialize({
    initializeForTesting: TESTING,
    tagForChildDirectedTreatment: true,
    tagForUnderAgeOfConsent: true,
    maxAdContentRating: MaxAdContentRating.General,
  })
    .then(() => {
      ready = true
      loadRewarded()
      loadInterstitial()
    })
    .catch(() => undefined)
}

/** True when a rewarded video can be offered right now. */
export function rewardedAvailable(): boolean {
  return ready && rewardedLoaded
}

/**
 * Plays the rewarded video. Resolves true only if the player watched it to the
 * end and earned the reward.
 */
export async function showRewarded(): Promise<boolean> {
  if (!rewardedAvailable()) return false
  rewardedLoaded = false
  let earned = false
  const handles: PluginListenerHandle[] = []
  try {
    let close = () => undefined as void
    const closed = new Promise<void>((resolve) => {
      close = resolve
    })
    handles.push(
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earned = true
      }),
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => close()),
      await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => close()),
    )
    await AdMob.showRewardVideoAd()
    await closed
  } catch {
    /* the ad could not be shown: no reward */
  } finally {
    for (const handle of handles) void handle.remove()
    loadRewarded()
  }
  return earned
}

/**
 * Counts a finished match and, every few matches, shows a full-screen ad.
 * Resolves once the ad is closed (or straight away when there is none).
 */
export async function afterMatch(): Promise<void> {
  if (!ready || !finishedFirstSection()) return
  matchesSinceInterstitial += 1
  if (matchesSinceInterstitial < MATCHES_BETWEEN_INTERSTITIALS || !interstitialLoaded) return
  matchesSinceInterstitial = 0
  interstitialLoaded = false
  const handles: PluginListenerHandle[] = []
  try {
    let close = () => undefined as void
    const closed = new Promise<void>((resolve) => {
      close = resolve
    })
    handles.push(
      await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => close()),
      await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => close()),
    )
    await AdMob.showInterstitial()
    await closed
  } catch {
    /* no ad this time */
  } finally {
    for (const handle of handles) void handle.remove()
    loadInterstitial()
  }
}
