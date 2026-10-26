import { ROSTER, type Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider } from '../../../services/storage'
import type { CollectionDefinition } from './collectionTypes'
import { validateCollection } from './validateCollection'

/*
 * The Lab's own data, kept in the player's active storage (this browser or
 * Dropbox) next to their saves: each uploaded collection, in lab/collections/.
 */

export const GEN_3_GAMES = ROSTER[3] as readonly Gen3GameId[]

/** Uploaded definitions, re-validated on every load. */
export async function loadUploadedCollections(
  provider: StorageProvider
): Promise<CollectionDefinition[]> {
  const definitions: CollectionDefinition[] = []
  for (const json of await provider.listLabCollections()) {
    const result = validateCollection(json)
    if (result.ok) definitions.push(result.definition)
    else console.warn('Skipped an invalid uploaded collection', result.errors)
  }
  return definitions.sort((a, b) => a.name.localeCompare(b.name))
}

export function saveUploadedCollection(
  provider: StorageProvider,
  definition: CollectionDefinition
): Promise<void> {
  return provider.putLabCollection(definition.id, definition)
}

export function discardUploadedCollection(
  provider: StorageProvider,
  collectionId: string
): Promise<void> {
  return provider.discardLabCollection(collectionId)
}
