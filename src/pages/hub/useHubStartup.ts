import { useEffect, useState } from 'react'
import { usePkHex } from '../context/PkHexContext'
import { updateAllCollections } from '../pokestorage/lab/collectionService'
import {
  useStorageOffline,
  useStorageSettings,
} from '../pokestorage/useStorage'
import {
  preloadSpriteSource,
  spriteSource,
} from '../../services/sprites/resources'
import { subscribeDataChanges } from '../../services/storage/sharedLoads'

/** A trade or restore writes more than once; one update follows them all. */
const CHANGE_SETTLE_MS = 500

/** Startup shares provider-scoped preferences and pending reads with every zone. */
export function useHubStartup() {
  const { provider, ready, settings, error } = useStorageSettings()
  const [retryError, setRetryError] = useState<string | null>(null)
  const sourceId = spriteSource(settings?.spriteSourceId)?.id ?? null
  const { adapter } = usePkHex()
  const offline = useStorageOffline()
  // Bumped on each Start press and after save data settles.
  const [starts, setStarts] = useState(0)
  const [changes, setChanges] = useState(0)

  useEffect(() => {
    if (!ready) return
    void provider
      .prefetch()
      .catch((cause: unknown) => console.warn('Storage prefetch failed', cause))
  }, [provider, ready])

  useEffect(() => {
    if (ready) preloadSpriteSource(sourceId)
  }, [ready, sourceId])

  useEffect(() => {
    if (starts === 0) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = subscribeDataChanges(provider, () => {
      clearTimeout(timer)
      timer = setTimeout(() => setChanges((n) => n + 1), CHANGE_SETTLE_MS)
    })
    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [provider, starts])

  // Collections follow the saves in the background; an open Lab re-reads
  // what this stores. Waits for storage and PKHeX before the first run.
  useEffect(() => {
    if (starts === 0 || !ready || !adapter || offline) return
    updateAllCollections(provider, adapter).catch((cause: unknown) =>
      console.warn('Collection update failed', cause)
    )
  }, [provider, ready, adapter, offline, starts, changes])

  return {
    provider,
    ready,
    sourceId,
    error: error?.message ?? retryError,
    retry: () => {
      setRetryError(null)
      void provider.getSettings().catch((cause: unknown) => {
        setRetryError(cause instanceof Error ? cause.message : String(cause))
      })
    },
    /** Scans every save and Camp Site into the collections, now and on change. */
    updateCollections: () => setStarts((n) => n + 1),
  }
}
