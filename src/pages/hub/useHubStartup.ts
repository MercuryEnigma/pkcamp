import { useEffect, useState } from 'react'
import { useStorageProvider } from '../pokestorage/useStorage'
import { SPRITE_SOURCES } from '../pokestorage/spriteSources'

/** Restore Dropbox before reading settings, and warm the active provider. */
export function useHubStartup() {
  const { provider, ready } = useStorageProvider()
  const [loadedProvider, setLoadedProvider] = useState<typeof provider | null>(
    null
  )
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    // Prefetch includes saves, Camps, settings and uploaded Lab collections.
    void provider.prefetch().catch((cause: unknown) => {
      console.warn('Storage prefetch failed', cause)
    })
    void provider
      .getSettings()
      .then((settings) => {
        if (cancelled) return
        const source = SPRITE_SOURCES.find(
          (item) => item.id === settings.spriteSourceId
        )
        setError(null)
        setSourceId(source?.id ?? null)
        setLoadedProvider(provider)
        // Start downloading the selected source's base sprites immediately.
        if (source) {
          for (const entry of source.manifest.filter(
            (item) => !item.shiny && !item.form && !item.gender
          )) {
            const image = new Image()
            image.src = entry.assetPath
          }
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : String(cause))
      })
    return () => {
      cancelled = true
    }
  }, [provider, ready, attempt])

  return {
    provider,
    ready: ready && loadedProvider === provider,
    sourceId,
    setSourceId,
    error,
    retry: () => {
      setError(null)
      setLoadedProvider(null)
      setAttempt((value) => value + 1)
    },
  }
}
