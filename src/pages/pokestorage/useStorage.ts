import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from 'react'
import { sprites } from '../../services/sprites/resources'
import { useSprites } from '../context/useSprites'
import { applyTheme } from '../../services/themes'
import {
  settingsSnapshot,
  subscribeSettings,
} from '../../services/storage/sharedLoads'
import {
  storage,
  StorageUnavailableError,
  type StorageProvider,
} from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'

let initialized: Promise<void> | null = null

/** Completes any Dropbox redirect or session restore once per page load. */
function initializeStorage(): Promise<void> {
  initialized ??= dropboxAccount.initialize()
  return initialized
}

/**
 * Waits for the first storage initialization, then tracks the active
 * provider. `ready` is false until the first load may start; screens use
 * `provider` as an effect dependency so they reload when it changes.
 */
export function useStorageProvider(): {
  provider: StorageProvider
  ready: boolean
} {
  const [provider, setProvider] = useState<StorageProvider>(storage.current)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const unsubscribe = storage.subscribe((next) => {
      if (!cancelled) setProvider(next)
    })
    initializeStorage()
      .catch(() => {})
      .then(() => {
        if (cancelled) return
        setProvider(storage.current)
        setReady(true)
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return { provider, ready }
}

/** Tracks `dropboxAccount.status`. */
export function useDropboxStatus() {
  return useSyncExternalStore(
    (listener) => dropboxAccount.subscribe(listener),
    () => dropboxAccount.status
  )
}

/**
 * True while Dropbox is the active storage but unreachable. Screens stay
 * readable and disable saving until it recovers.
 */
export function useStorageOffline(): boolean {
  const { provider } = useStorageProvider()
  const status = useDropboxStatus()
  return provider.id === 'dropbox' && status.state === 'error'
}

/** A player-facing message for a failed storage call. */
export function storageErrorMessage(cause: unknown): string {
  if (cause instanceof StorageUnavailableError) return cause.message
  return cause instanceof Error ? cause.message : String(cause)
}

/** Shared preferences; writes update all mounted consumers immediately. */
export function useStorageSettings() {
  const { provider, ready } = useStorageProvider()
  const snapshot = useSyncExternalStore(
    (listener) => subscribeSettings(provider, listener),
    () => settingsSnapshot(provider)
  )
  useEffect(() => {
    if (ready) void provider.getSettings().catch(() => {})
  }, [provider, ready])
  return { ...snapshot, provider, ready: ready && snapshot.settings !== null }
}

/**
 * Selects the saved sprite source once settings load and whenever it
 * changes, which starts preloading its art. Each app root calls this.
 */
export function useSpriteStartup() {
  const { ready, settings } = useStorageSettings()
  const sourceId = settings?.spriteSourceId ?? null
  useEffect(() => {
    if (ready) sprites.select(sourceId)
  }, [ready, sourceId])
}

/** The sprite resolver for the current, shared sprite preference. */
export function useSpriteResolver() {
  return useSprites().resolver
}

/** Applies the shared theme preference; until it loads, the boot hint stays. */
export function useSavedTheme() {
  const { settings, ready } = useStorageSettings()
  const themeId = settings?.themeId
  useLayoutEffect(() => {
    if (ready) applyTheme(themeId)
  }, [ready, themeId])
}
