import type { Gen3GameId } from '../../../services/saveLibrary'
import type {
  StorageProvider,
  StoredCollectionResult,
} from '../../../services/storage'
import type {
  CabinScanStatus,
  CampScanStatus,
  CollectionDefinition,
  EntryMatch,
  ScannedPokemon,
} from './collectionTypes'

type StoredEntry = StoredCollectionResult['entries'][string]
type StoredMatch = StoredEntry['matches'][number]

export interface MergedStatuses {
  entries: Record<string, StoredEntry>
  owned: number
  seen: number
  total: number
}

/** Only the summary of a match is stored, never the whole Pokémon. */
export function toStoredMatch(scanned: ScannedPokemon): StoredMatch {
  const { node, source } = scanned
  const where =
    'camp' in source
      ? { camp: true as const, location: source.location }
      : {
          gameId: source.gameId,
          location: source.location,
          ...(source.boxName !== undefined ? { boxName: source.boxName } : {}),
        }
  return {
    ...where,
    species: node.species,
    form: node.form,
    nickname: node.nickname,
    originalTrainerName: node.originalTrainerName,
    originalTrainerId: node.originalTrainerId,
    level: node.level,
    shiny: node.shiny,
    moves: node.moves.flatMap((move) => (move ? [move.name] : [])),
    ...(node.ability ? { ability: node.ability.name } : {}),
    ...(node.nature ? { nature: node.nature.name } : {}),
    ...(node.heldItemName ? { heldItem: node.heldItemName } : {}),
    ribbons: node.ribbons.map((ribbon) => ribbon.name),
  }
}

/**
 * Combines this scan with the stored history into one status per entry:
 * matched is owned; unmatched but owned or seen before is seen; the rest are
 * unseen. History is keyed by entry id, so removed entries drop out and new
 * ones start unseen.
 */
export function mergeStatuses(
  definition: CollectionDefinition,
  matches: Record<string, EntryMatch>,
  previous: StoredCollectionResult | null,
  scannedAt: string
): MergedStatuses {
  const entries: Record<string, StoredEntry> = {}
  let owned = 0
  let seen = 0
  for (const entryId of Object.keys(definition.pokemon)) {
    const match = matches[entryId]
    const before = previous?.entries[entryId]
    const wasOwned = before?.status === 'owned' || before?.status === 'seen'
    if (match?.matched) {
      owned++
      entries[entryId] = {
        status: 'owned',
        firstOwnedAt: before?.firstOwnedAt ?? scannedAt,
        lastOwnedAt: scannedAt,
        matches: match.matches.map(toStoredMatch),
      }
    } else if (wasOwned) {
      seen++
      entries[entryId] = {
        status: 'seen',
        ...(before.firstOwnedAt !== undefined
          ? { firstOwnedAt: before.firstOwnedAt }
          : {}),
        ...(before.lastOwnedAt !== undefined
          ? { lastOwnedAt: before.lastOwnedAt }
          : {}),
        matches: [],
      }
    } else {
      entries[entryId] = { status: 'unseen', matches: [] }
    }
  }
  return {
    entries,
    owned,
    seen,
    total: Object.keys(definition.pokemon).length,
  }
}

export function toStoredResult(
  definition: CollectionDefinition,
  merged: MergedStatuses,
  cabins: readonly CabinScanStatus[],
  scannedAt: string,
  /** The Camp Sites' scan, when they were a source. */
  camp: CampScanStatus | null = null
): StoredCollectionResult {
  return {
    version: 2,
    collectionId: definition.id,
    collectionName: definition.name,
    collectionVersion: definition.metadata.version,
    scannedAt,
    sources: cabins.flatMap((cabin) =>
      cabin.state === 'ok'
        ? [
            {
              gameId: cabin.gameId,
              saveUpdatedAt: cabin.updatedAt.toISOString(),
            },
          ]
        : []
    ),
    ...(camp?.state === 'ok' ? { campFingerprint: camp.fingerprint } : {}),
    owned: merged.owned,
    seen: merged.seen,
    total: merged.total,
    entries: merged.entries,
  }
}

export type StaleReason =
  'version' | 'sources' | 'unscanned-cabin' | 'newer-save' | 'camp'

export const STALE_REASON_LABEL: Record<StaleReason, string> = {
  version: 'The collection changed since the last scan.',
  sources: 'The selected Cabins changed since the last scan.',
  'unscanned-cabin': 'A selected Cabin has a save that was not scanned yet.',
  'newer-save': 'A Cabin save changed since the last scan.',
  camp: 'Camp Sites changed since the last scan.',
}

/**
 * Why a stored result needs a rescan, or null when it is fresh.
 * `currentSaves` holds each Cabin's current save timestamp, or null/missing
 * when it has no save; only selected Cabins with a save count as sources.
 * `campFingerprint` is the current Camp's digest when Camp Sites are a
 * source, or null when they are not.
 */
export function isStale(
  stored: StoredCollectionResult,
  definition: CollectionDefinition,
  selectedGameIds: readonly Gen3GameId[],
  currentSaves: Partial<Record<Gen3GameId, Date | null>>,
  campFingerprint: string | null = null
): StaleReason | null {
  if (stored.collectionVersion !== definition.metadata.version) {
    return 'version'
  }
  const current = selectedGameIds.filter((id) => currentSaves[id])
  const scanned = new Set<string>(stored.sources.map((s) => s.gameId))
  if (
    stored.sources.some(
      (source) => !current.includes(source.gameId as Gen3GameId)
    )
  ) {
    return 'sources'
  }
  if (current.some((id) => !scanned.has(id))) return 'unscanned-cabin'
  if ((stored.campFingerprint ?? null) !== campFingerprint) return 'camp'
  for (const source of stored.sources) {
    const updatedAt = currentSaves[source.gameId as Gen3GameId]
    if (updatedAt && updatedAt.getTime() > Date.parse(source.saveUpdatedAt)) {
      return 'newer-save'
    }
  }
  return null
}

/** The save timestamps `isStale` compares against, read from storage. */
export async function readCurrentSaves(
  provider: StorageProvider,
  gameIds: readonly Gen3GameId[]
): Promise<Partial<Record<Gen3GameId, Date | null>>> {
  const entries = await Promise.all(
    gameIds.map(
      async (id) =>
        [id, (await provider.getSave(id))?.updatedAt ?? null] as const
    )
  )
  return Object.fromEntries(entries)
}
