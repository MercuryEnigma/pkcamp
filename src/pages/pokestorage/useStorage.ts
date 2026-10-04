import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { initializeSpriteResolver } from '../../services/sprites'
import {
  storage,
  StorageUnavailableError,
  type StorageProvider,
} from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'

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

/** The sprite resolver for the stored sprite source, default until loaded. */
export function useSpriteResolver() {
  const { provider, ready } = useStorageProvider()
  const [sourceId, setSourceId] = useState(DEFAULT_SPRITE_SOURCE_ID)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    provider
      .getSettings()
      .then((settings) => {
        const stored = SPRITE_SOURCES.find(
          (source) => source.id === settings.spriteSourceId
        )
        if (!cancelled) setSourceId(stored?.id ?? DEFAULT_SPRITE_SOURCE_ID)
      })
      .catch(() => {
        // Keep the default sprites while storage is unreachable.
      })
    return () => {
      cancelled = true
    }
  }, [provider, ready])

  return useMemo(() => {
    const source =
      SPRITE_SOURCES.find((item) => item.id === sourceId) ?? SPRITE_SOURCES[0]
    return initializeSpriteResolver({
      sourceId: source.id,
      manifest: source.manifest,
      formAliases: source.formAliases,
    })
  }, [sourceId])
}
