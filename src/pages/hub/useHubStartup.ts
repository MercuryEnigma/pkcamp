import { useState } from 'react'
import {
  useSavedTheme,
  useSpriteStartup,
  useStorageSettings,
} from '../pokestorage/useStorage'
import { spriteSource } from '../../services/sprites/resources'

/** Startup shares provider-scoped preferences and pending reads with every zone. */
export function useHubStartup() {
  const { provider, ready, settings, error } = useStorageSettings()
  const [retryError, setRetryError] = useState<string | null>(null)
  const sourceId = spriteSource(settings?.spriteSourceId)?.id ?? null
  useSpriteStartup()
  useSavedTheme()

  return {
    provider,
    ready,
    sourceId,
    themeId: settings?.themeId ?? null,
    error: error?.message ?? retryError,
    retry: () => {
      setRetryError(null)
      void provider.getSettings().catch((cause: unknown) => {
        setRetryError(cause instanceof Error ? cause.message : String(cause))
      })
    },
  }
}
