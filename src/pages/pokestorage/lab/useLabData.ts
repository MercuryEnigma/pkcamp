import { collectionDisplay } from './collectionDisplay'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import type { StorageProvider } from '../../../services/storage'
import { storageErrorMessage, useStorageProvider } from '../useStorage'
import { BUILT_IN_COLLECTIONS, isBuiltInId } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'
import {
  discardUploadedCollection,
  loadUploadedCollections,
  saveUploadedCollection,
} from './labStore'
import { validateCollection } from './validateCollection'

interface Loaded {
  provider: StorageProvider
  uploads: CollectionDefinition[]
}

/**
 * The Lab's stored data from the active storage: the scanned sources and the
 * uploaded collections. Reloads when the player switches storage. Until it
 * has loaded, `ready` is false and nothing should be scanned.
 */
export function useLabData() {
  const { t } = useTranslation(['lab', 'common'] as const)

  const { provider, ready: storageReady } = useStorageProvider()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    async function load() {
      try {
        const uploads = await loadUploadedCollections(provider)
        if (!cancelled) setLoaded({ provider, uploads })
      } catch (cause) {
        if (cancelled) return
        setErrors([storageErrorMessage(cause)])
        setLoaded({ provider, uploads: [] })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [provider, storageReady])

  const current = loaded?.provider === provider ? loaded : null
  const uploads = current?.uploads ?? []

  const update = (patch: Partial<Omit<Loaded, 'provider'>>) =>
    setLoaded((previous) =>
      previous?.provider === provider ? { ...previous, ...patch } : previous
    )

  /** Validates and stores a file; resolves to the new id, or null if rejected. */
  async function upload(file: File): Promise<string | null> {
    setErrors([])
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      setErrors([
        t('useLabData.isNotValidJson', { name: file.name, reason: reason }),
      ])
      return null
    }
    const result = validateCollection(json)
    if (!result.ok) {
      setErrors(result.errors)
      return null
    }
    const { definition } = result
    if (isBuiltInId(definition.id)) {
      setErrors([
        t('useLabData.idIsABuiltInCollectionAndCannotBeReplaced', {
          id: definition.id,
        }),
      ])
      return null
    }
    const exists = uploads.some((c) => c.id === definition.id)
    if (
      exists &&
      !window.confirm(
        t('useLabData.replaceTheUploadedCollection', { id: definition.id })
      )
    ) {
      return null
    }
    try {
      await saveUploadedCollection(provider, definition)
    } catch (cause) {
      setErrors([
        t('useLabData.wasNotSaved', {
          name: file.name,
          value2: storageErrorMessage(cause),
        }),
      ])
      return null
    }
    update({
      uploads: [...uploads.filter((c) => c.id !== definition.id), definition],
    })
    return definition.id
  }

  /** Removes an upload and its stored result, after the player confirms. */
  async function remove(definition: CollectionDefinition): Promise<boolean> {
    if (isBuiltInId(definition.id)) return false
    if (
      !window.confirm(
        t('useLabData.removeAndItsSavedHistoryThisCannotBeUndone', {
          name: collectionDisplay(definition).name,
        })
      )
    ) {
      return false
    }
    try {
      await discardUploadedCollection(provider, definition.id)
    } catch (cause) {
      setErrors([
        t('useLabData.notRemoved', { value1: storageErrorMessage(cause) }),
      ])
      return false
    }
    update({ uploads: uploads.filter((c) => c.id !== definition.id) })
    try {
      await provider.discardCollectionResult(definition.id)
    } catch (cause) {
      console.warn('Could not remove the stored result', cause)
    }
    return true
  }

  /** Clears a built-in collection's stored result, after the player confirms. */
  async function clearHistory(definition: CollectionDefinition) {
    if (
      !window.confirm(
        t('useLabData.clearTheSavedHistoryOfEntriesNoLongerInA', {
          name: collectionDisplay(definition).name,
        })
      )
    ) {
      return false
    }
    try {
      await provider.discardCollectionResult(definition.id)
      return true
    } catch (cause) {
      setErrors([
        t('useLabData.notCleared', { value1: storageErrorMessage(cause) }),
      ])
      return false
    }
  }

  /**
   * Removes every uploaded collection and clears every stored result,
   * built-ins included, after the player confirms once.
   */
  async function removeAll(): Promise<boolean> {
    if (
      !window.confirm(
        t('useLabData.deleteAllUploadedCollectionsAndClearTheSavedHistoryOf')
      )
    ) {
      return false
    }
    setErrors([])
    const failed: string[] = []
    const kept: CollectionDefinition[] = []
    for (const definition of uploads) {
      try {
        await discardUploadedCollection(provider, definition.id)
      } catch (cause) {
        failed.push(
          t('useLabData.collectionFailure', {
            name: collectionDisplay(definition).name,
            value2: storageErrorMessage(cause),
          })
        )
        kept.push(definition)
      }
    }
    update({ uploads: kept })
    for (const definition of [...BUILT_IN_COLLECTIONS, ...uploads]) {
      if (kept.includes(definition)) continue
      try {
        await provider.discardCollectionResult(definition.id)
      } catch (cause) {
        failed.push(
          t('useLabData.collectionFailure', {
            name: collectionDisplay(definition).name,
            value2: storageErrorMessage(cause),
          })
        )
      }
    }
    if (failed.length > 0)
      setErrors(failed.map((f) => t('useLabData.notDeleted', { f: f })))
    return failed.length === 0
  }

  return {
    ready: current !== null,
    uploads,
    errors,
    clearErrors: () => setErrors([]),
    upload,
    remove,
    clearHistory,
    removeAll,
  }
}
