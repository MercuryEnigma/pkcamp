import type { PokemonSaveAdapter } from '../../../services/pkhex'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type {
  Camp,
  StorageProvider,
  StoredCollectionResult,
  StoredSave,
} from '../../../services/storage'
import { storageErrorMessage } from '../useStorage'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import { isStale } from './collectionResults'
import {
  CAMP_SOURCE,
  type CabinScanStatus,
  type CampScanStatus,
  type CollectionDefinition,
  type LabSourceId,
} from './collectionTypes'
import {
  GEN_3_GAMES,
  loadSelectedSources,
  loadUploadedCollections,
} from './labStore'
import {
  evaluateResearchSnapshot,
  scanResearchSnapshot,
  type ResearchSnapshot,
} from './researchSnapshot'
import { campFingerprint, campPokemonCount } from './scanCamp'

/*
 * Keeps stored collection results in step with the player's saves. Any
 * screen can call `updateCollections` with any collections and sources: a
 * matching Pokémon makes its entry owned, and an entry owned before with no
 * match now becomes seen. Runs are queued per storage, so the hub's
 * background update and an open Lab never scan at the same time.
 */

/** What a scan reads: the Cabin saves and the Gen 3 Camp, per the selection. */
export interface CollectionSources {
  files: Partial<Record<Gen3GameId, StoredSave | null>>
  /** Each Cabin's save timestamp, or null without a save. */
  saves: Partial<Record<Gen3GameId, Date | null>>
  /** Selected Cabins that hold a save. */
  targets: Gen3GameId[]
  camp: Camp | null
  campError: string | null
  /** Camp Pokémon stored at the Camp Sites; null when unreadable. */
  campCount: number | null
  /** Whether Camp Sites are a wanted source, readable or not. */
  campWanted: boolean
  /** Whether Camp Sites are scanned. */
  campTarget: boolean
  fingerprint: string | null
}

/** Reads the sources; `selected` null means every source that holds data. */
export async function loadCollectionSources(
  provider: StorageProvider,
  selected: readonly LabSourceId[] | null
): Promise<CollectionSources> {
  const [files, read] = await Promise.all([
    Promise.all(
      GEN_3_GAMES.map(async (id) => [id, await provider.getSave(id)] as const)
    ).then((entries) => Object.fromEntries(entries)),
    // A Camp that can't be read must not stop the Cabins from scanning.
    provider.getCamp(3).then(
      (value): Camp | { error: string } => value,
      (cause: unknown) => ({ error: storageErrorMessage(cause) })
    ),
  ])
  const campError = 'error' in read ? read.error : null
  const camp = 'error' in read ? null : read
  const campCount = camp ? campPokemonCount(camp) : null
  // By default Camp Sites count once they hold a Pokémon, like Cabins once
  // they hold a save; an explicit selection decides otherwise.
  const campWanted =
    selected === null ? (campCount ?? 0) > 0 : selected.includes(CAMP_SOURCE)
  const campTarget = campWanted && camp !== null
  return {
    files,
    saves: Object.fromEntries(
      GEN_3_GAMES.map((id) => [id, files[id]?.updatedAt ?? null])
    ),
    targets: GEN_3_GAMES.filter(
      (id) => (selected === null || selected.includes(id)) && files[id]
    ),
    camp,
    campError,
    campCount,
    campWanted,
    campTarget,
    fingerprint: camp && campTarget ? campFingerprint(camp) : null,
  }
}

export interface UpdateCollectionsOptions {
  provider: StorageProvider
  /** Null while PKHeX loads; stale results then wait for it. */
  adapter: PokemonSaveAdapter | null
  definitions: readonly CollectionDefinition[]
  sources: CollectionSources
  /** Rescan every collection, fresh or not. */
  force?: boolean
  /** A collection whose history is discarded before the scan. */
  resetId?: string | null
  /** Read stored results only, as while Dropbox is offline. */
  readOnly?: boolean
  /** Passed back to `subscribeCollectionUpdates` listeners. */
  origin?: unknown
  /** Called once stored results are read, before any scan. */
  onHistory?: (
    history: Record<string, StoredCollectionResult | null>,
    errors: Record<string, string>
  ) => void
  /** Called when a scan starts. */
  onScanning?: () => void
}

export interface CollectionUpdate {
  results: Record<string, StoredCollectionResult | null>
  /** Storage errors by collection id. */
  errors: Record<string, string>
  cabins: CabinScanStatus[]
  camp: CampScanStatus | null
  /** True when new results could not all be stored. */
  unsaved: boolean
  /** True when stale results wait for PKHeX. */
  waitingForPkHex: boolean
  /** Collections rescanned by this call. */
  updated: string[]
}

const queues = new WeakMap<StorageProvider, Promise<unknown>>()

/** Runs one update at a time per storage. */
function enqueue<T>(provider: StorageProvider, run: () => Promise<T>) {
  const next = (queues.get(provider) ?? Promise.resolve()).then(run, run)
  queues.set(
    provider,
    next.catch(() => {})
  )
  return next
}

/** The last decoded sources per storage, reused while nothing changed. */
const snapshots = new WeakMap<
  StorageProvider,
  { key: string; snapshot: ResearchSnapshot }
>()

type UpdateListener = (origin: unknown) => void
const listeners = new WeakMap<StorageProvider, Set<UpdateListener>>()

/** Calls `listener` whenever new results are stored for this storage. */
export function subscribeCollectionUpdates(
  provider: StorageProvider,
  listener: UpdateListener
): () => void {
  let set = listeners.get(provider)
  if (!set) listeners.set(provider, (set = new Set()))
  set.add(listener)
  return () => set.delete(listener)
}

/**
 * Brings the stored results of `definitions` up to date with `sources`.
 * Only stale results are rescanned unless `force` is set. New results are
 * stored when every source was read; a partial scan is returned unsaved so
 * it can never turn owned entries into seen ones by mistake.
 */
export function updateCollections(
  options: UpdateCollectionsOptions
): Promise<CollectionUpdate> {
  return enqueue(options.provider, () => runUpdate(options))
}

async function runUpdate({
  provider,
  adapter,
  definitions,
  sources,
  force = false,
  resetId = null,
  readOnly = false,
  origin,
  onHistory,
  onScanning,
}: UpdateCollectionsOptions): Promise<CollectionUpdate> {
  const errors: Record<string, string> = {}
  const { targets, saves, files, fingerprint, campTarget } = sources
  const key = [
    ...targets.map((id) => `${id}@${saves[id]?.getTime()}`),
    fingerprint ?? '',
  ].join('|')
  const cached = snapshots.get(provider)
  // Without a rescan, the last scan of these same sources still describes them.
  const idle = (
    results: Record<string, StoredCollectionResult | null>,
    waitingForPkHex = false
  ): CollectionUpdate => ({
    results,
    errors,
    cabins: cached?.key === key ? cached.snapshot.cabins : [],
    camp: cached?.key === key ? (cached.snapshot.camp ?? null) : null,
    unsaved: false,
    waitingForPkHex,
    updated: [],
  })

  if (resetId && !readOnly) await provider.discardCollectionResult(resetId)
  const history: Record<string, StoredCollectionResult | null> =
    Object.fromEntries(
      await Promise.all(
        definitions.map(async (definition) => {
          try {
            return [
              definition.id,
              await provider.getCollectionResult(definition.id),
            ] as const
          } catch (cause) {
            errors[definition.id] = storageErrorMessage(cause)
            return [definition.id, null] as const
          }
        })
      )
    )
  onHistory?.(history, { ...errors })
  if (readOnly) return idle(history)

  const stale = definitions.filter(
    (definition) =>
      force ||
      !history[definition.id] ||
      isStale(
        history[definition.id]!,
        definition,
        targets,
        saves,
        fingerprint
      ) !== null
  )
  if (stale.length === 0) return idle(history)
  const hasSources = targets.length > 0 || campTarget
  if (hasSources && !adapter) return idle(history, true)

  onScanning?.()
  let snapshot = !force && cached?.key === key ? cached.snapshot : null
  if (!snapshot) {
    snapshot = hasSources
      ? await scanResearchSnapshot(
          provider,
          adapter!,
          targets,
          files,
          campTarget ? sources.camp : null
        )
      : { pokemon: [], cabins: [], camp: null }
    if (snapshot.cabins.some((cabin) => cabin.state === 'error'))
      snapshots.delete(provider)
    else snapshots.set(provider, { key, snapshot })
  }

  const results = {
    ...history,
    ...evaluateResearchSnapshot(
      stale,
      snapshot,
      history,
      new Date().toISOString()
    ),
  }
  const camp: CampScanStatus | null =
    sources.campWanted && sources.campError
      ? { state: 'error', message: sources.campError }
      : (snapshot.camp ?? null)
  // With no sources at all, every entry owned before is now seen: that is a
  // complete result and is stored like any other.
  let unsaved =
    snapshot.cabins.some((cabin) => cabin.state === 'error') ||
    camp?.state === 'error'
  const updated: string[] = []
  if (!unsaved) {
    for (const definition of stale) {
      // A failed history read must not be overwritten by a fresh baseline.
      if (errors[definition.id]) {
        unsaved = true
        continue
      }
      try {
        await provider.putCollectionResult(results[definition.id]!)
        updated.push(definition.id)
      } catch (cause) {
        errors[definition.id] = storageErrorMessage(cause)
        unsaved = true
      }
    }
  }
  if (updated.length > 0) {
    for (const listener of listeners.get(provider) ?? []) listener(origin)
  }
  return {
    results,
    errors,
    cabins: snapshot.cabins,
    camp,
    unsaved,
    waitingForPkHex: false,
    updated,
  }
}

/** Built-in and uploaded collections, as the Lab shows them. */
export async function loadAllCollections(
  provider: StorageProvider
): Promise<CollectionDefinition[]> {
  return [...BUILT_IN_COLLECTIONS, ...(await loadUploadedCollections(provider))]
}

/**
 * Updates every collection against the player's chosen sources. The hub
 * calls this on Start and after save data changes.
 */
export async function updateAllCollections(
  provider: StorageProvider,
  adapter: PokemonSaveAdapter | null,
  readOnly = false
): Promise<CollectionUpdate> {
  const [definitions, selected] = await Promise.all([
    loadAllCollections(provider),
    loadSelectedSources(provider),
  ])
  return updateCollections({
    provider,
    adapter,
    definitions,
    sources: await loadCollectionSources(provider, selected),
    readOnly,
  })
}
