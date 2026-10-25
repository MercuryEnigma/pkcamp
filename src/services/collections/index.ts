import type { PokemonNode } from '../pkhex'
import type { Gen3GameId } from '../saveLibrary'
import type {
  Camp,
  CampPosition,
  StorageProvider,
  StoredCollectionMatch,
  StoredCollectionResult,
  StoredSave,
} from '../storage'
import {
  activeGame,
  type ActiveGameChange,
  type ActiveGameService,
  type CommittedActiveGameView,
} from '../activeGame'
import { BUILT_IN_COLLECTIONS } from '../../pages/pokestorage/lab/builtInCollections'
import type {
  CollectionDefinition,
  ScannedPokemon,
} from '../../pages/pokestorage/lab/collectionTypes'
import { evaluateCollection } from '../../pages/pokestorage/lab/evaluateCollection'
import { loadUploadedCollections } from '../../pages/pokestorage/lab/labStore'
import { campFingerprint, scanCamp } from '../../pages/pokestorage/lab/scanCamp'
import { toStoredMatch } from '../../pages/pokestorage/lab/collectionResults'

export type CollectionsStatus =
  'idle' | 'loading' | 'scanning' | 'ready' | 'error'
export type CollectionFilter = 'all' | 'registered' | 'missing' | 'visiting'

export interface CollectionWorkspace {
  selectedEntryId: string | null
  query: string
  filter: CollectionFilter
  scrollTop: number
}

export interface CollectionsSnapshot {
  status: CollectionsStatus
  provider: StorageProvider | null
  definitions: readonly CollectionDefinition[]
  results: Readonly<Record<string, StoredCollectionResult | null>>
  errors: Readonly<Record<string, string>>
  enabledIds: readonly string[]
  recentIds: readonly string[]
  overflowIds: readonly string[]
  currentId: string | null
  workspaces: Readonly<Record<string, CollectionWorkspace>>
  registered: number
  total: number
  revision: number
  error: Error | null
}

const EMPTY_WORKSPACE: CollectionWorkspace = Object.freeze({
  selectedEntryId: null,
  query: '',
  filter: 'all',
  scrollTop: 0,
})

const INITIAL: CollectionsSnapshot = Object.freeze({
  status: 'idle',
  provider: null,
  definitions: [],
  results: {},
  errors: {},
  enabledIds: [],
  recentIds: [],
  overflowIds: [],
  currentId: null,
  workspaces: {},
  registered: 0,
  total: 0,
  revision: 0,
  error: null,
})

type ScanSource = Gen3GameId | 'camp'

interface ScannedSource {
  source: ScanSource
  pokemon: ScannedPokemon[]
  saveUpdatedAt: Date | null
  campFingerprint: string | null
  unreadableCampPositions: Set<string>
}

function errorFrom(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

function campPositionKey(position: CampPosition): string {
  return `${position.site}:${position.index}`
}

function scanSave(
  gameId: Gen3GameId,
  save: NonNullable<CommittedActiveGameView['save']>
): ScannedPokemon[] {
  const pokemon: ScannedPokemon[] = []
  for (const node of save.party) {
    if (node) pokemon.push({ node, source: { gameId, location: 'party' } })
  }
  save.boxes.forEach((box, boxIndex) => {
    box.slots.forEach((node, slot) => {
      if (!node) return
      pokemon.push({
        node,
        source: {
          gameId,
          location: { box: boxIndex, slot },
          boxName: box.name,
        },
      })
    })
  })
  return pokemon
}

function unreadableCampPositions(
  camp: Camp,
  importPokemon: (bytes: Uint8Array) => PokemonNode
): Set<string> {
  const unreadable = new Set<string>()
  camp.sites.forEach((site, siteIndex) => {
    site.forEach((stored, index) => {
      if (!stored) return
      try {
        importPokemon(stored.bytes)
      } catch {
        unreadable.add(campPositionKey({ site: siteIndex, index }))
      }
    })
  })
  return unreadable
}

function matchIsSource(
  match: StoredCollectionMatch,
  source: ScanSource
): boolean {
  return source === 'camp'
    ? 'camp' in match
    : !('camp' in match) && match.gameId === source
}

function retainMatch(
  match: StoredCollectionMatch,
  scan: ScannedSource,
  definitionChanged: boolean
): boolean {
  if (definitionChanged) return false
  if (!matchIsSource(match, scan.source)) return true
  if (scan.source !== 'camp' || !('camp' in match)) return false
  return scan.unreadableCampPositions.has(campPositionKey(match.location))
}

function mergeDefinition(
  definition: CollectionDefinition,
  previous: StoredCollectionResult | null,
  scans: readonly ScannedSource[],
  scannedAt: string
): StoredCollectionResult {
  const definitionChanged =
    previous?.collectionVersion !== definition.metadata.version
  const evaluated = scans.map((scan) => ({
    scan,
    matches: evaluateCollection(definition, scan.pokemon),
  }))
  const entries: StoredCollectionResult['entries'] = {}
  let owned = 0
  let seen = 0

  for (const entryId of Object.keys(definition.pokemon)) {
    const before = previous?.entries[entryId]
    const retained = (before?.matches ?? []).filter((match) =>
      scans.every((scan) => retainMatch(match, scan, definitionChanged))
    )
    const rescanned = evaluated.flatMap(({ matches }) =>
      (matches[entryId]?.matches ?? []).map(toStoredMatch)
    )
    const matches = [...retained, ...rescanned]
    const wasRegistered =
      before?.status === 'owned' || before?.status === 'seen'
    if (matches.length > 0) {
      owned += 1
      entries[entryId] = {
        status: 'owned',
        firstOwnedAt: before?.firstOwnedAt ?? scannedAt,
        lastOwnedAt: rescanned.length > 0 ? scannedAt : before?.lastOwnedAt,
        matches,
      }
    } else if (wasRegistered) {
      seen += 1
      entries[entryId] = {
        status: 'seen',
        ...(before?.firstOwnedAt ? { firstOwnedAt: before.firstOwnedAt } : {}),
        ...(before?.lastOwnedAt ? { lastOwnedAt: before.lastOwnedAt } : {}),
        matches: [],
      }
    } else {
      entries[entryId] = { status: 'unseen', matches: [] }
    }
  }

  const scannedGames = new Set(
    scans.flatMap((scan) => (scan.source === 'camp' ? [] : [scan.source]))
  )
  const sources = (definitionChanged ? [] : (previous?.sources ?? []))
    .filter((source) => !scannedGames.has(source.gameId as Gen3GameId))
    .concat(
      scans.flatMap((scan) =>
        scan.source !== 'camp' && scan.saveUpdatedAt
          ? [
              {
                gameId: scan.source,
                saveUpdatedAt: scan.saveUpdatedAt.toISOString(),
              },
            ]
          : []
      )
    )
  const campScan = scans.find((scan) => scan.source === 'camp')

  return {
    version: 2,
    collectionId: definition.id,
    collectionName: definition.name,
    collectionVersion: definition.metadata.version,
    scannedAt,
    sources,
    ...(campScan?.campFingerprint
      ? { campFingerprint: campScan.campFingerprint }
      : !campScan && previous?.campFingerprint
        ? { campFingerprint: previous.campFingerprint }
        : {}),
    owned,
    seen,
    total: Object.keys(definition.pokemon).length,
    entries,
  }
}

function clampWorkspace(
  workspace: CollectionWorkspace,
  result: StoredCollectionResult | null
): CollectionWorkspace {
  const selectedEntryId =
    workspace.selectedEntryId && result?.entries[workspace.selectedEntryId]
      ? workspace.selectedEntryId
      : null
  return { ...workspace, selectedEntryId }
}

export class CollectionsService {
  private readonly games: ActiveGameService
  private snapshot: CollectionsSnapshot = INITIAL
  private readonly listeners = new Set<() => void>()
  private readonly unsubscribers: (() => void)[]
  private sessionVersion = 0
  private scanContextVersion = 0
  private queue: Promise<void> = Promise.resolve()
  private loadedProvider: StorageProvider | null = null
  private providerLoad: Promise<void> | null = null
  private selectedGameId: Gen3GameId | null | undefined

  constructor(games: ActiveGameService = activeGame) {
    this.games = games
    this.unsubscribers = [
      games.subscribe(() => this.handleActiveSnapshot()),
      games.subscribeChanges((change) => this.handleActiveChange(change)),
    ]
    this.handleActiveSnapshot()
  }

  getSnapshot = (): CollectionsSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.listeners.clear()
  }

  async initialize(): Promise<void> {
    const active = this.games.getSnapshot()
    if (active.status !== 'ready' || !active.provider) return
    await this.ensureProvider(active.provider)
    await this.schedule(this.initialSources(active.gameId))
  }

  async refresh(): Promise<void> {
    const active = this.games.getSnapshot()
    if (active.status !== 'ready' || !active.provider) return
    await this.ensureProvider(active.provider)
    await this.schedule(this.initialSources(active.gameId))
  }

  async reloadDefinitions(): Promise<void> {
    const provider = this.games.getSnapshot().provider
    if (!provider) return
    await this.loadProvider(provider, true)
    await this.refresh()
  }

  openCollection(collectionId: string): void {
    if (!this.snapshot.enabledIds.includes(collectionId))
      throw new Error('Enable the collection before opening it.')
    const recentIds = [
      collectionId,
      ...this.snapshot.recentIds.filter((id) => id !== collectionId),
    ].filter((id) => this.snapshot.enabledIds.includes(id))
    this.publishDerived({
      ...this.snapshot,
      currentId: collectionId,
      recentIds,
    })
  }

  setEnabled(collectionIds: readonly string[]): void {
    const available = new Set(this.snapshot.definitions.map((item) => item.id))
    const enabledIds = [...new Set(collectionIds)].filter((id) =>
      available.has(id)
    )
    if (enabledIds.length === 0)
      throw new Error('At least one collection must remain enabled.')
    let recentIds = this.snapshot.recentIds.filter((id) =>
      enabledIds.includes(id)
    )
    const currentId = enabledIds.includes(this.snapshot.currentId ?? '')
      ? this.snapshot.currentId
      : (recentIds[0] ?? enabledIds[0])
    if (currentId)
      recentIds = [currentId, ...recentIds.filter((id) => id !== currentId)]
    this.publishDerived({
      ...this.snapshot,
      enabledIds,
      recentIds,
      currentId,
    })
  }

  updateWorkspace(
    collectionId: string,
    patch: Partial<CollectionWorkspace>
  ): void {
    if (!this.snapshot.definitions.some((item) => item.id === collectionId))
      return
    const current = this.snapshot.workspaces[collectionId] ?? EMPTY_WORKSPACE
    const workspace = clampWorkspace(
      { ...current, ...patch },
      this.snapshot.results[collectionId] ?? null
    )
    this.publishDerived({
      ...this.snapshot,
      workspaces: { ...this.snapshot.workspaces, [collectionId]: workspace },
    })
  }

  async resetHistory(collectionId: string): Promise<void> {
    const { provider } = this.snapshot
    if (!provider) return
    await provider.discardCollectionResult(collectionId)
    this.publishDerived({
      ...this.snapshot,
      results: { ...this.snapshot.results, [collectionId]: null },
    })
    await this.refresh()
  }

  private handleActiveSnapshot(): void {
    const active = this.games.getSnapshot()
    if (active.status !== 'ready' || !active.provider) return
    if (this.loadedProvider !== active.provider) {
      void this.ensureProvider(active.provider).then(() =>
        this.schedule(this.initialSources(active.gameId))
      )
      return
    }
    if (this.selectedGameId !== active.gameId) {
      this.selectedGameId = active.gameId
      this.scanContextVersion += 1
      void this.schedule(this.initialSources(active.gameId))
    }
  }

  private handleActiveChange(change: ActiveGameChange): void {
    if (change.provider !== this.loadedProvider) return
    const source: ScanSource = change.kind === 'camp' ? 'camp' : change.gameId!
    if (source) void this.schedule([source])
  }

  private initialSources(gameId: Gen3GameId | null): ScanSource[] {
    return gameId ? [gameId, 'camp'] : ['camp']
  }

  private async ensureProvider(provider: StorageProvider): Promise<void> {
    if (this.loadedProvider === provider) {
      if (this.providerLoad) await this.providerLoad
      return
    }
    const load = this.loadProvider(provider, false)
    this.providerLoad = load
    try {
      await load
    } finally {
      if (this.providerLoad === load) this.providerLoad = null
    }
  }

  private async loadProvider(
    provider: StorageProvider,
    preserveSession: boolean
  ): Promise<void> {
    const session = ++this.sessionVersion
    this.scanContextVersion += 1
    if (!preserveSession) {
      this.loadedProvider = provider
      this.selectedGameId = this.games.getSnapshot().gameId
      this.publish({
        ...INITIAL,
        status: 'loading',
        provider,
        revision: this.snapshot.revision + 1,
      })
    }
    try {
      const definitions = [
        ...BUILT_IN_COLLECTIONS,
        ...(await loadUploadedCollections(provider)),
      ]
      const results = Object.fromEntries(
        await Promise.all(
          definitions.map(async (definition) => [
            definition.id,
            await provider.getCollectionResult(definition.id),
          ])
        )
      ) as Record<string, StoredCollectionResult | null>
      if (session !== this.sessionVersion) return
      const availableIds = definitions.map((definition) => definition.id)
      const previousEnabled = preserveSession
        ? this.snapshot.enabledIds.filter((id) => availableIds.includes(id))
        : []
      const enabledIds =
        previousEnabled.length > 0 ? previousEnabled : availableIds
      const previousRecent = preserveSession
        ? this.snapshot.recentIds.filter((id) => enabledIds.includes(id))
        : []
      const currentId =
        preserveSession && enabledIds.includes(this.snapshot.currentId ?? '')
          ? this.snapshot.currentId
          : (previousRecent[0] ?? enabledIds[0] ?? null)
      const recentIds = currentId
        ? [currentId, ...previousRecent.filter((id) => id !== currentId)]
        : []
      this.publishDerived({
        ...this.snapshot,
        status: 'ready',
        provider,
        definitions,
        results,
        enabledIds,
        recentIds,
        currentId,
        error: null,
      })
    } catch (cause) {
      if (session !== this.sessionVersion) return
      this.publish({
        ...this.snapshot,
        status: 'error',
        error: errorFrom(cause),
        revision: this.snapshot.revision + 1,
      })
    }
  }

  private schedule(sources: readonly ScanSource[]): Promise<void> {
    const context = this.scanContextVersion
    const unique = [...new Set(sources)]
    const run = () => this.runScan(unique, context)
    this.queue = this.queue.then(run, run)
    return this.queue
  }

  private async runScan(
    sources: readonly ScanSource[],
    context: number
  ): Promise<void> {
    const active = this.games.getSnapshot()
    if (
      active.status !== 'ready' ||
      !active.provider ||
      active.provider !== this.loadedProvider
    )
      return
    const session = this.sessionVersion
    this.publish({
      ...this.snapshot,
      status: 'scanning',
      revision: this.snapshot.revision + 1,
      error: null,
    })
    try {
      const scans: ScannedSource[] = []
      for (const source of sources) {
        scans.push(await this.scanSource(source, active.provider))
      }
      if (
        session !== this.sessionVersion ||
        context !== this.scanContextVersion
      )
        return
      const scannedAt = new Date().toISOString()
      const results = { ...this.snapshot.results }
      const errors: Record<string, string> = {}
      for (const definition of this.snapshot.definitions) {
        const result = mergeDefinition(
          definition,
          results[definition.id] ?? null,
          scans,
          scannedAt
        )
        try {
          await active.provider.putCollectionResult(result)
          results[definition.id] = result
        } catch (cause) {
          errors[definition.id] = errorFrom(cause).message
        }
      }
      if (
        session !== this.sessionVersion ||
        context !== this.scanContextVersion
      )
        return
      const workspaces = Object.fromEntries(
        Object.entries(this.snapshot.workspaces).map(([id, workspace]) => [
          id,
          clampWorkspace(workspace, results[id] ?? null),
        ])
      )
      this.publishDerived({
        ...this.snapshot,
        status: 'ready',
        results,
        errors,
        workspaces,
        error: null,
      })
    } catch (cause) {
      if (
        session !== this.sessionVersion ||
        context !== this.scanContextVersion
      )
        return
      this.publish({
        ...this.snapshot,
        status: 'error',
        error: errorFrom(cause),
        revision: this.snapshot.revision + 1,
      })
    }
  }

  private async scanSource(
    source: ScanSource,
    provider: StorageProvider
  ): Promise<ScannedSource> {
    if (source === 'camp') {
      return this.games.readCommitted((view) => ({
        source,
        pokemon: scanCamp(view.adapter, view.camp).pokemon,
        saveUpdatedAt: null,
        campFingerprint: campFingerprint(view.camp),
        unreadableCampPositions: unreadableCampPositions(view.camp, (bytes) =>
          view.adapter.importPokemonFile(bytes)
        ),
      }))
    }
    const active = this.games.getSnapshot()
    if (active.gameId === source) {
      return this.games.readCommitted((view) => ({
        source,
        pokemon: view.save ? scanSave(source, view.save) : [],
        saveUpdatedAt: view.saveUpdatedAt,
        campFingerprint: null,
        unreadableCampPositions: new Set(),
      }))
    }
    const stored = await provider.getSave(source)
    return this.games.readCommitted((view) =>
      this.scanStoredSave(source, stored, view)
    )
  }

  private scanStoredSave(
    source: Gen3GameId,
    stored: StoredSave | null,
    view: CommittedActiveGameView
  ): ScannedSource {
    if (!stored) {
      return {
        source,
        pokemon: [],
        saveUpdatedAt: null,
        campFingerprint: null,
        unreadableCampPositions: new Set(),
      }
    }
    const save = view.adapter.load(stored.bytes)
    try {
      return {
        source,
        pokemon: scanSave(source, save),
        saveUpdatedAt: stored.updatedAt,
        campFingerprint: null,
        unreadableCampPositions: new Set(),
      }
    } finally {
      save.dispose()
    }
  }

  private publishDerived(snapshot: CollectionsSnapshot): void {
    const enabled = new Set(snapshot.enabledIds)
    let registered = 0
    let total = 0
    for (const definition of snapshot.definitions) {
      if (!enabled.has(definition.id)) continue
      const result = snapshot.results[definition.id]
      registered += result ? result.owned + result.seen : 0
      total += result?.total ?? Object.keys(definition.pokemon).length
    }
    const recentIds = snapshot.recentIds.filter((id) => enabled.has(id))
    const visibleRecent = recentIds.slice(0, 2)
    const overflowIds = snapshot.enabledIds.filter(
      (id) => !visibleRecent.includes(id)
    )
    this.publish({
      ...snapshot,
      registered,
      total,
      recentIds,
      overflowIds,
      revision: this.snapshot.revision + 1,
    })
  }

  private publish(snapshot: CollectionsSnapshot): void {
    this.snapshot = Object.freeze(snapshot)
    for (const listener of this.listeners) listener()
  }
}

export const collections = new CollectionsService()
