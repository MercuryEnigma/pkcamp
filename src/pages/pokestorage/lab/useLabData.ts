import { useEffect, useState } from 'react'
import type { StorageProvider } from '../../../services/storage'
import { storageErrorMessage, useStorageProvider } from '../useStorage'
import { BUILT_IN_COLLECTIONS, isBuiltInId } from './builtInCollections'
import type { CollectionDefinition, LabSourceId } from './collectionTypes'
import {
  discardUploadedCollection,
  loadSelectedSources,
  loadUploadedCollections,
  migrateBrowserLabData,
  saveSelectedSources,
  saveUploadedCollection,
} from './labStore'
import { validateCollection } from './validateCollection'

interface Loaded {
  provider: StorageProvider
  sources: LabSourceId[] | null
  uploads: CollectionDefinition[]
}

/**
 * The Lab's stored data from the active storage: the scanned sources and the
 * uploaded collections. Reloads when the player switches storage. Until it
 * has loaded, `ready` is false and nothing should be scanned.
 */
export function useLabData() {
  const { provider, ready: storageReady } = useStorageProvider()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    if (!storageReady) return
    let cancelled = false
    async function load() {
      try {
        await migrateBrowserLabData(provider).catch((cause: unknown) =>
          // Offline or read-only: try again next time; still load what exists.
          console.warn('Could not move browser Lab data into storage', cause)
        )
        const [sources, uploads] = await Promise.all([
          loadSelectedSources(provider),
          loadUploadedCollections(provider),
        ])
        if (!cancelled) setLoaded({ provider, sources, uploads })
      } catch (cause) {
        if (cancelled) return
        setErrors([storageErrorMessage(cause)])
        setLoaded({ provider, sources: null, uploads: [] })
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

  /** Saves the selection; the scan follows it right away either way. */
  async function setSources(next: LabSourceId[]) {
    update({ sources: next })
    try {
      await saveSelectedSources(provider, next)
    } catch (cause) {
      setErrors([`Sources not saved: ${storageErrorMessage(cause)}`])
    }
  }

  /** Validates and stores a file; resolves to the new id, or null if rejected. */
  async function upload(file: File): Promise<string | null> {
    setErrors([])
    let json: unknown
    try {
      json = JSON.parse(await file.text())
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      setErrors([`${file.name} is not valid JSON: ${reason}`])
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
        `id: "${definition.id}" is a built-in collection and cannot be replaced`,
      ])
      return null
    }
    const exists = uploads.some((c) => c.id === definition.id)
    if (
      exists &&
      !window.confirm(`Replace the uploaded collection "${definition.id}"?`)
    ) {
      return null
    }
    try {
      await saveUploadedCollection(provider, definition)
    } catch (cause) {
      setErrors([`${file.name} was not saved: ${storageErrorMessage(cause)}`])
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
        `Remove "${definition.name}" and its saved history? This cannot be undone.`
      )
    ) {
      return false
    }
    try {
      await discardUploadedCollection(provider, definition.id)
    } catch (cause) {
      setErrors([`Not removed: ${storageErrorMessage(cause)}`])
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
        `Clear the saved history of "${definition.name}"? Entries no longer in a Cabin or Camp Site will go back to Missing.`
      )
    ) {
      return false
    }
    try {
      await provider.discardCollectionResult(definition.id)
      return true
    } catch (cause) {
      setErrors([`Not cleared: ${storageErrorMessage(cause)}`])
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
        'Delete all uploaded collections and clear the saved history of every collection? This cannot be undone.'
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
        failed.push(`${definition.name}: ${storageErrorMessage(cause)}`)
        kept.push(definition)
      }
    }
    update({ uploads: kept })
    for (const definition of [...BUILT_IN_COLLECTIONS, ...uploads]) {
      if (kept.includes(definition)) continue
      try {
        await provider.discardCollectionResult(definition.id)
      } catch (cause) {
        failed.push(`${definition.name}: ${storageErrorMessage(cause)}`)
      }
    }
    if (failed.length > 0) setErrors(failed.map((f) => `Not deleted: ${f}`))
    return failed.length === 0
  }

  return {
    ready: current !== null,
    sources: current?.sources ?? null,
    setSources,
    uploads,
    errors,
    clearErrors: () => setErrors([]),
    upload,
    remove,
    clearHistory,
    removeAll,
  }
}
