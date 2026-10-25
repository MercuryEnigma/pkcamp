import type { Gen3GameId } from '../saveLibrary'
import type { StorageProvider } from '../storage/types'
import { shareStorageLoads, subscribeDataChanges } from '../storage/sharedLoads'
import { digest, extract } from './extractor'
import { readGen3RomHeader } from './rom'
import {
  getSpecies,
  getEvolutionFamily,
  getEncounters,
  getLocation,
  searchSpecies,
  getEggMoves,
  getEggMoveFathers,
  getEvolutionFamilyEdges,
} from './queries'
import { getAcquisitionRoutes } from './acquisition'
import {
  POKEDEX_EXTRACTOR_VERSION,
  POKEDEX_SCHEMA_VERSION,
  UnsupportedRomError,
  type ExtractOptions,
  type PokedexDataset,
} from './types'

export * from './types'
export * from './queries'
export * from './acquisition'
export { extract, extractDirect } from './extractor'
export { decodeGen3Text, readGen3RomHeader, readRomPointer } from './rom'

export type GuideStatus =
  'idle' | 'loading' | 'ready' | 'unavailable' | 'unsupported' | 'error'

export interface GuideSnapshot {
  status: GuideStatus
  gameId: Gen3GameId | null
  provider: StorageProvider | null
  dataset: PokedexDataset | null
  error: Error | null
}

const INITIAL: GuideSnapshot = Object.freeze({
  status: 'idle',
  gameId: null,
  provider: null,
  dataset: null,
  error: null,
})
const encoder = new TextEncoder()

/** Reference data is shared by consumers, so callers cannot mutate it. */
function freezeDataset<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDataset(child)
    Object.freeze(value)
  }
  return value
}

function cachedDataset(
  bytes: Uint8Array | undefined,
  gameId: Gen3GameId,
  romSha256: string,
  metadataFingerprint: string | null
): PokedexDataset | null {
  if (!bytes) return null
  try {
    const data = JSON.parse(new TextDecoder().decode(bytes)) as PokedexDataset
    if (
      data.schemaVersion !== POKEDEX_SCHEMA_VERSION ||
      data.extractorVersion !== POKEDEX_EXTRACTOR_VERSION ||
      data.romSha256 !== romSha256 ||
      data.metadataFingerprint !== metadataFingerprint ||
      data.game?.id !== gameId ||
      !data.species ||
      typeof data.species !== 'object' ||
      !data.locations ||
      !data.capabilities ||
      !Array.isArray(data.warnings)
    )
      return null
    for (const species of Object.values(data.species)) {
      if (
        !species ||
        typeof species.name !== 'string' ||
        !species.stats ||
        !Array.isArray(species.types) ||
        !Array.isArray(species.abilities) ||
        !Array.isArray(species.learnsets?.levelUp) ||
        !Array.isArray(species.evolutions?.to) ||
        !Array.isArray(species.evolutions?.from) ||
        !Array.isArray(species.encounters)
      )
        return null
    }
    return data
  } catch {
    return null
  }
}

/**
 * Owns reference data for the selected ROM for the lifetime of the app.
 * Selection starts loading; views only subscribe and query retained data.
 * A new document (including Arcade) initializes from the saved sidecar.
 */
export class GuideService {
  private snapshot: GuideSnapshot = INITIAL
  private readonly listeners = new Set<() => void>()
  private version = 0
  private pending: Promise<void> | null = null
  private controller: AbortController | null = null
  private unsubscribeRom: (() => void) | null = null
  private options: ExtractOptions = {}
  private readonly extractor: typeof extract

  constructor(extractor: typeof extract = extract) {
    this.extractor = extractor
  }

  getSnapshot = (): GuideSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  select(
    gameId: Gen3GameId | null,
    source: StorageProvider,
    options: ExtractOptions = {}
  ): Promise<void> {
    const provider = shareStorageLoads(source)
    if (
      this.snapshot.gameId === gameId &&
      this.snapshot.provider === provider &&
      this.options.metadata === options.metadata
    ) {
      return this.pending ?? Promise.resolve()
    }
    this.cancel()
    this.options = { ...options }
    this.publish({
      status: gameId ? 'loading' : 'idle',
      gameId,
      provider,
      dataset: null,
      error: null,
    })
    if (!gameId) return Promise.resolve()
    this.unsubscribeRom = subscribeDataChanges(provider, (change) => {
      if (change.kind === 'rom' && change.gameId === gameId) void this.refresh()
    })
    return this.start(gameId, provider)
  }

  /** Explicit retry, or automatic reload after a successful ROM replacement. */
  refresh(): Promise<void> {
    const { gameId, provider } = this.snapshot
    if (!gameId || !provider) return Promise.resolve()
    this.controller?.abort()
    this.version++
    this.publish({
      ...this.snapshot,
      status: 'loading',
      dataset: null,
      error: null,
    })
    return this.start(gameId, provider)
  }

  clear(): void {
    this.cancel()
    this.publish(INITIAL)
  }

  dispose(): void {
    this.clear()
    this.listeners.clear()
  }

  getSpecies(nationalDexNumber: number) {
    return this.snapshot.dataset
      ? getSpecies(this.snapshot.dataset, nationalDexNumber)
      : undefined
  }

  getEvolutionFamily(nationalDexNumber: number) {
    return this.snapshot.dataset
      ? getEvolutionFamily(this.snapshot.dataset, nationalDexNumber)
      : []
  }

  getEvolutionFamilyEdges(nationalDexNumber: number) {
    return this.snapshot.dataset
      ? getEvolutionFamilyEdges(this.snapshot.dataset, nationalDexNumber)
      : []
  }

  getEggMoves(nationalDexNumber: number) {
    return this.snapshot.dataset
      ? getEggMoves(this.snapshot.dataset, nationalDexNumber)
      : []
  }

  getEggMoveFathers(moveRomId: number, hatchedAs: readonly number[]) {
    return this.snapshot.dataset
      ? getEggMoveFathers(this.snapshot.dataset, moveRomId, hatchedAs)
      : []
  }

  getAcquisitionRoutes(nationalDexNumber: number) {
    return this.snapshot.dataset
      ? getAcquisitionRoutes(this.snapshot.dataset, nationalDexNumber)
      : []
  }

  getEncounters(nationalDexNumber: number) {
    return this.snapshot.dataset
      ? getEncounters(this.snapshot.dataset, nationalDexNumber)
      : []
  }

  getLocation(mapId: string) {
    return this.snapshot.dataset
      ? getLocation(this.snapshot.dataset, mapId)
      : []
  }

  searchSpecies(query: string) {
    return this.snapshot.dataset
      ? searchSpecies(this.snapshot.dataset, query)
      : []
  }

  private cancel() {
    this.version++
    this.controller?.abort()
    this.controller = null
    this.pending = null
    this.unsubscribeRom?.()
    this.unsubscribeRom = null
  }

  private start(gameId: Gen3GameId, provider: StorageProvider): Promise<void> {
    const version = ++this.version
    const controller = new AbortController()
    this.controller = controller
    const current = () => version === this.version && !controller.signal.aborted
    const pending = this.initialize(
      gameId,
      provider,
      this.options,
      controller.signal,
      current
    )
      .catch((cause: unknown) => {
        if (!current()) return
        this.publish({
          ...this.snapshot,
          dataset: null,
          status:
            cause instanceof UnsupportedRomError ? 'unsupported' : 'error',
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      })
      .finally(() => {
        if (current()) this.pending = null
      })
    this.pending = pending
    return pending
  }

  private async initialize(
    gameId: Gen3GameId,
    provider: StorageProvider,
    options: ExtractOptions,
    signal: AbortSignal,
    current: () => boolean
  ): Promise<void> {
    // Read once at selection. No repeated ROM downloads, hashes or dataset
    // clones when a page opens or a different species is selected.
    const [rom, saved] = await Promise.all([
      provider.getRom(gameId),
      provider.getPokedex(gameId).catch(() => null),
    ])
    if (!current()) return
    if (!rom) {
      this.publish({
        ...this.snapshot,
        status: 'unavailable',
        dataset: null,
        error: null,
      })
      return
    }
    const header = readGen3RomHeader(rom.bytes)
    if (!header || header.gameId !== gameId)
      throw new UnsupportedRomError(`The stored ROM does not match ${gameId}.`)
    const [romSha256, metadataFingerprint] = await Promise.all([
      digest(rom.bytes),
      options.metadata
        ? digest(encoder.encode(options.metadata))
        : Promise.resolve(null),
    ])
    if (!current()) return
    const cached = cachedDataset(
      saved?.bytes,
      gameId,
      romSha256,
      metadataFingerprint
    )
    const dataset = cached ?? (await this.extractor(rom.bytes, options, signal))
    if (!current()) return
    const ready = freezeDataset(dataset)
    this.publish({
      ...this.snapshot,
      status: 'ready',
      dataset: ready,
      error: null,
    })
    if (cached) return
    try {
      if (current())
        await provider.putPokedex(gameId, {
          bytes: encoder.encode(JSON.stringify(ready)),
        })
    } catch {
      if (current())
        this.publish({
          ...this.snapshot,
          dataset: freezeDataset({
            ...ready,
            warnings: [
              ...ready.warnings,
              { code: 'storage-unavailable' as const },
            ],
          }),
        })
    }
  }

  private publish(snapshot: GuideSnapshot) {
    this.snapshot = Object.freeze(snapshot)
    for (const listener of this.listeners) listener()
  }
}

export const guide = new GuideService()
