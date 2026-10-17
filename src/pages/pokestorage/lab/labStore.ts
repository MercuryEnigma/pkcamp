import { ROSTER, type Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider } from '../../../services/storage'
import { GAME_LABEL } from '../gameDisplay'
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
  return source === CAMP_SOURCE ? 'Camp Sites' : `${GAME_LABEL[source]} Cabin`
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

/*
 * Earlier builds kept this data in this browser's localStorage. The first
 * time the Lab opens with a writable storage, it moves that data across and
 * clears the old keys. Anything already in storage wins.
 */
const LEGACY_SOURCES_KEY = 'pkcamp.lab.sources'
const LEGACY_UPLOADS_KEY = 'pkcamp.lab.uploadedCollections'

function readLegacy(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

export async function migrateBrowserLabData(
  provider: StorageProvider
): Promise<void> {
  const sources = readLegacy(LEGACY_SOURCES_KEY)
  const uploads = readLegacy(LEGACY_UPLOADS_KEY)
  if (sources === undefined && uploads === undefined) return

  if (Array.isArray(sources)) {
    const current = await provider.getLabSettings()
    const legacy = parseSources(sources as string[])
    if (current.sources === null && legacy) {
      // Camp Sites are a newer source; an old selection still includes them.
      await saveSelectedSources(provider, [...legacy, CAMP_SOURCE])
    }
  }
  if (Array.isArray(uploads)) {
    const existing = new Set(
      (await loadUploadedCollections(provider)).map((d) => d.id)
    )
    for (const json of uploads) {
      const result = validateCollection(json)
      if (result.ok && !existing.has(result.definition.id)) {
        await saveUploadedCollection(provider, result.definition)
      }
    }
  }
  try {
    localStorage.removeItem(LEGACY_SOURCES_KEY)
    localStorage.removeItem(LEGACY_UPLOADS_KEY)
  } catch {
    // Storage blocked: the copy above is done; leaving the keys is harmless.
  }
}
