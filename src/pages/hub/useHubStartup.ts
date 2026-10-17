import { useEffect, useState } from 'react'
import { useStorageSettings } from '../pokestorage/useStorage'
import {
  preloadSpriteSource,
  spriteSource,
} from '../../services/sprites/resources'

/** Startup shares provider-scoped preferences and pending reads with every zone. */
export function useHubStartup() {
  const { provider, ready, settings, error } = useStorageSettings()
  const [retryError, setRetryError] = useState<string | null>(null)
  const sourceId = spriteSource(settings?.spriteSourceId)?.id ?? null

  useEffect(() => {
    if (!ready) return
    void provider
      .prefetch()
      .catch((cause: unknown) => console.warn('Storage prefetch failed', cause))
  }, [provider, ready])

  useEffect(() => {
    if (ready) preloadSpriteSource(sourceId)
  }, [ready, sourceId])

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
  }
}
