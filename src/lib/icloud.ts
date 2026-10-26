import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { mergeSavedStates } from './mergeSave'
import { hydrateState, readState, registerSync, type SavedState } from './save'

/** Native side: ios/App/App/ICloudSavePlugin.swift (iCloud key-value store). */
interface ICloudSavePlugin {
  get(options: { key: string }): Promise<{ value: string | null }>
  set(options: { key: string; value: string }): Promise<void>
  remove(options: { key: string }): Promise<void>
  addListener(
    event: 'change',
    listener: (change: { key: string; value: string | null }) => void,
  ): Promise<PluginListenerHandle>
}

const ICloudSave = registerPlugin<ICloudSavePlugin>('ICloudSave')

const KEY = 'memoryhistory.guardado'
const PUSH_DELAY_MS = 1500

function parse(value: string | null): SavedState | null {
  if (!value) return null
  try {
    return JSON.parse(value) as SavedState
  } catch {
    return null
  }
}

/** Take in a copy from iCloud: best of both, then store the result on both sides. */
function adopt(remote: SavedState | null) {
  if (!remote) return
  const merged = mergeSavedStates(readState(), remote)
  hydrateState(merged, { syncCloud: false })
  void ICloudSave.set({ key: KEY, value: JSON.stringify(merged) }).catch(() => undefined)
}

/**
 * On iPhone and iPad the save also lives in the player's iCloud, so it follows
 * them to their other Apple devices. Elsewhere it does nothing: the web keeps
 * the save in the browser and Android's Auto Backup copies it on its own.
 */
export function initICloud(): () => void {
  if (Capacitor.getPlatform() !== 'ios') return () => undefined

  let timer: ReturnType<typeof setTimeout> | null = null
  registerSync((state) => {
    if (timer) clearTimeout(timer)
    if (!state) {
      void ICloudSave.remove({ key: KEY }).catch(() => undefined)
      return
    }
    timer = setTimeout(() => {
      void ICloudSave.set({ key: KEY, value: JSON.stringify(state) }).catch(() => undefined)
    }, PUSH_DELAY_MS)
  })

  void ICloudSave.get({ key: KEY })
    .then(({ value }) => {
      const remote = parse(value)
      if (remote) adopt(remote)
      else void ICloudSave.set({ key: KEY, value: JSON.stringify(readState()) })
    })
    .catch(() => undefined)

  const listening = ICloudSave.addListener('change', ({ key, value }) => {
    if (key === KEY) adopt(parse(value))
  })

  return () => {
    if (timer) clearTimeout(timer)
    registerSync(null)
    void listening.then((handle) => handle.remove())
  }
}
