import { i18n } from '../../../services/i18n'
import { ROSTER, type Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider } from '../../../services/storage'
import { getGameLabel } from '../gameDisplay'
import {
  CAMP_SOURCE,
  type CollectionDefinition,
  type LabSourceId,
} from './collectionTypes'
import { validateCollection } from './validateCollection'

/*
 * The Lab's own data, kept in the player's active storage (this browser or
 * Dropbox) next to their saves: which sources the Pokédex scans, in
 * lab/settings.json, and each uploaded collection, in lab/collections/.
 */

export const GEN_3_GAMES = ROSTER[3] as readonly Gen3GameId[]

/** Every source the Pokédex can scan, in display order. */
export const LAB_SOURCES: readonly LabSourceId[] = [...GEN_3_GAMES, CAMP_SOURCE]

export function sourceLabel(source: LabSourceId): string {
  return source === CAMP_SOURCE
    ? i18n.t('collections:labStore.campSites')
    : i18n.t('collections:labStore.cabin', { value1: getGameLabel(source) })
}

/** Stored source ids, or null when missing or not all recognized. */
function parseSources(stored: string[] | null): LabSourceId[] | null {
  if (
    !stored ||
    !stored.every((id) => LAB_SOURCES.includes(id as LabSourceId))
  ) {
    return null
  }
  return LAB_SOURCES.filter((id) => stored.includes(id))
}

/** The stored source selection, or null for "every source with data". */
export async function loadSelectedSources(
  provider: StorageProvider
): Promise<LabSourceId[] | null> {
  return parseSources((await provider.getLabSettings()).sources)
}

export function saveSelectedSources(
  provider: StorageProvider,
  sources: readonly LabSourceId[]
): Promise<void> {
  return provider.saveLabSettings({ sources: [...sources] })
}

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
