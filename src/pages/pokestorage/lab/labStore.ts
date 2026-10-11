import { ROSTER, type Gen3GameId } from '../../../services/saveLibrary'
import type { CollectionDefinition } from './collectionTypes'
import { validateCollection } from './validateCollection'

/*
 * Interim per-browser store. The selected Cabins and uploaded definitions
 * live in localStorage, so they do not follow the player to another device
 * or storage provider. Moving them into the StorageProvider is a pending
 * owner decision. Until then a stored result for an uploaded collection can
 * exist on a device that does not have its definition: ignore it there, and
 * never delete it.
 */

const SOURCES_KEY = 'pkcamp.lab.sources'
const UPLOADS_KEY = 'pkcamp.lab.uploadedCollections'

export const GEN_3_GAMES = ROSTER[3] as readonly Gen3GameId[]

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (cause) {
    console.warn(`Could not save ${key}`, cause)
  }
}

/** The stored Cabin selection, or null when missing or invalid. */
export function loadSelectedSources(): Gen3GameId[] | null {
  const stored = readJson(SOURCES_KEY)
  if (
    !Array.isArray(stored) ||
    !stored.every((id) => GEN_3_GAMES.includes(id as Gen3GameId))
  ) {
    return null
  }
  return GEN_3_GAMES.filter((id) => stored.includes(id))
}

export function saveSelectedSources(gameIds: readonly Gen3GameId[]): void {
  writeJson(SOURCES_KEY, gameIds)
}

/** Uploaded definitions, re-validated on every load. */
export function loadUploadedCollections(): CollectionDefinition[] {
  const stored = readJson(UPLOADS_KEY)
  if (!Array.isArray(stored)) return []
  const definitions: CollectionDefinition[] = []
  for (const json of stored) {
    const result = validateCollection(json)
    if (result.ok) definitions.push(result.definition)
    else console.warn('Dropped an invalid uploaded collection', result.errors)
  }
  return definitions
}

export function saveUploadedCollections(
  definitions: readonly CollectionDefinition[]
): void {
  writeJson(UPLOADS_KEY, definitions)
}
