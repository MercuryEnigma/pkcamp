import { useState } from 'react'
import { storage } from '../../../services/storage'
import { isBuiltInId } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'
import { loadUploadedCollections, saveUploadedCollections } from './labStore'
import { validateCollection } from './validateCollection'

/** Uploaded collections, kept per browser (see labStore.ts). */
export function useUploadedCollections() {
  const [uploads, setUploads] = useState<CollectionDefinition[]>(
    loadUploadedCollections
  )
  const [errors, setErrors] = useState<string[]>([])

  const commit = (next: CollectionDefinition[]) => {
    setUploads(next)
    saveUploadedCollections(next)
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
    commit([...uploads.filter((c) => c.id !== definition.id), definition])
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
    commit(uploads.filter((c) => c.id !== definition.id))
    try {
      await storage.discardCollectionResult(definition.id)
    } catch (cause) {
      console.warn('Could not remove the stored result', cause)
    }
    return true
  }

  return { uploads, errors, clearErrors: () => setErrors([]), upload, remove }
}
