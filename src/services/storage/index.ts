import { shareStorageLoads } from './sharedLoads'
import type { GameId, Generation } from '../saveLibrary'
import { MemoryFileStore, type FileStore } from './fileStore'
import { FileStoreProvider } from './fileStoreProvider'
import { IndexedDbFileStore } from './indexedDbFileStore'
import type {
  Camp,
  StorageProvider,
  LabSettings,
  StorageSettings,
  StoredCollectionResult,
  StoredRom,
} from './types'

export type {
  LabSettings,
  StoredCollectionMatch,
  Camp,
  CampPokemon,
  CampPosition,
  CampSite,
  StorageProvider,
  StorageSettings,
  StoredCollectionResult,
  StoredRom,
  StoredSave,
} from './types'
export {
  CAMP_SITE_SIZE,
  DEFAULT_CAMP_SITE_COUNT,
  StorageUnavailableError,
} from './types'
export type { FileStore, FileStoreEntry, StoredFile } from './fileStore'
export { MemoryFileStore } from './fileStore'
export {
  FileStoreProvider,
  dayOf,
  emptyCamp,
  prefetchPaths,
} from './fileStoreProvider'

function createLocalStore(): FileStore {
  // No IndexedDB (tests, very old browsers): keep data for this page only.
  if (typeof indexedDB === 'undefined') return new MemoryFileStore()
  return new IndexedDbFileStore()
}

/** The browser-local files behind `localStorageProvider`. */
export const localFileStore: FileStore = createLocalStore()

/** Browser-local storage, used whenever no cloud account is connected. */
export const localStorageProvider: StorageProvider = shareStorageLoads(
  new FileStoreProvider(localFileStore, { id: 'local', label: 'This browser' })
)

type Listener = (provider: StorageProvider) => void

/**
 * The player's selected storage. Delegates every call to the active
 * provider: the local provider by default, or a cloud provider while the
 * player is signed in to one. Screens subscribe to reload when it changes.
 */
class ActiveStorage implements StorageProvider {
  private provider: StorageProvider = localStorageProvider
  private readonly listeners = new Set<Listener>()

  get id(): StorageProvider['id'] {
    return this.provider.id
  }

  get label(): string {
    return this.provider.label
  }

  get current(): StorageProvider {
    return this.provider
  }

  /** Switches providers; null returns to local storage. */
  use(provider: StorageProvider | null): void {
    const next = provider ? shareStorageLoads(provider) : localStorageProvider
    if (next === this.provider) return
    this.provider = next
    for (const listener of this.listeners) listener(next)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSave(gameId: GameId) {
    return this.provider.getSave(gameId)
  }
  getPreviousSave(gameId: GameId) {
    return this.provider.getPreviousSave(gameId)
  }
  putSave(gameId: GameId, bytes: Uint8Array) {
    return this.provider.putSave(gameId, bytes)
  }
  discardSave(gameId: GameId) {
    return this.provider.discardSave(gameId)
  }
  listSaveDays(gameId: GameId) {
    return this.provider.listSaveDays(gameId)
  }
  putHardwareSave(gameId: GameId, bytes: Uint8Array) {
    return this.provider.putHardwareSave(gameId, bytes)
  }
  getHardwareSave(gameId: GameId) {
    return this.provider.getHardwareSave(gameId)
  }
  getRom(gameId: GameId) {
    return this.provider.getRom(gameId)
  }
  hasRom(gameId: GameId) {
    return this.provider.hasRom(gameId)
  }
  putRom(gameId: GameId, rom: StoredRom) {
    return this.provider.putRom(gameId, rom)
  }
  discardRom(gameId: GameId) {
    return this.provider.discardRom(gameId)
  }
  getCamp(generation: Generation) {
    return this.provider.getCamp(generation)
  }
  saveCamp(generation: Generation, camp: Camp) {
    return this.provider.saveCamp(generation, camp)
  }
  getCollectionResult(collectionId: string) {
    return this.provider.getCollectionResult(collectionId)
  }
  putCollectionResult(result: StoredCollectionResult) {
    return this.provider.putCollectionResult(result)
  }
  discardCollectionResult(collectionId: string) {
    return this.provider.discardCollectionResult(collectionId)
  }
  getSettings() {
    return this.provider.getSettings()
  }
  saveSettings(settings: StorageSettings) {
    return this.provider.saveSettings(settings)
  }
  getLabSettings() {
    return this.provider.getLabSettings()
  }
  saveLabSettings(settings: LabSettings) {
    return this.provider.saveLabSettings(settings)
  }
  listLabCollections() {
    return this.provider.listLabCollections()
  }
  putLabCollection(collectionId: string, definition: unknown) {
    return this.provider.putLabCollection(collectionId, definition)
  }
  discardLabCollection(collectionId: string) {
    return this.provider.discardLabCollection(collectionId)
  }
  prefetch() {
    return this.provider.prefetch()
  }
}

/** Shared storage for application code. */
export const storage = new ActiveStorage()
