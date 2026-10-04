import type { GameId, Generation } from '../saveLibrary'

/** Pokémon spaces in one Camp Site, matching a main-series box. */
export const CAMP_SITE_SIZE = 30
/** Camp Sites a generation starts with before the player changes it. */
export const DEFAULT_CAMP_SITE_COUNT = 10

/** One standalone `.pk*` file staying at a Camp Site. */
export interface CampPokemon {
  /** Stable file identity; a Pokémon's position is where it sits in `Camp`. */
  id: string
  fileName: string
  bytes: Uint8Array
  importedAt: string
}

/** Exactly `CAMP_SITE_SIZE` positions, with null for an empty space. */
export type CampSite = (CampPokemon | null)[]

/**
 * A generation's Camping Pokémon, addressed like main-series boxes: a
 * Pokémon lives at `sites[site][index]` and stays there until moved. The
 * number of sites is part of the stored data.
 */
export interface Camp {
  sites: CampSite[]
}

/** A Camp position, the Camp Site counterpart of a save's box slot. */
export interface CampPosition {
  site: number
  index: number
}

export interface StoredSave {
  bytes: Uint8Array
  updatedAt: Date
}

export interface StoredRom {
  bytes: Uint8Array
  /** File extension without the dot, e.g. `gba` or `nds`. */
  extension: string
}

/** Player preferences that follow the player's selected storage. */
export interface StorageSettings {
  /** Sprite source id, or null for the app default. */
  spriteSourceId: string | null
}

/**
 * One place a player's data can live: browser-local IndexedDB, Dropbox, or a
 * future cloud store. Every provider stores the same data with the same
 * meaning, so the rest of the app never knows which one is active.
 *
 * Saves are kept per calendar day. The first `putSave` of a day starts that
 * day's entry and keeps the latest earlier day's save as its previous save;
 * later saves that day replace only the current save. Days without a change
 * have no entry.
 */
export interface StorageProvider {
  readonly id: 'local' | 'dropbox'
  readonly label: string

  /** The newest save for a game, or null if none is stored. */
  getSave(gameId: GameId): Promise<StoredSave | null>
  /** The save that the newest day's first update replaced, if any. */
  getPreviousSave(gameId: GameId): Promise<Uint8Array | null>
  putSave(gameId: GameId, bytes: Uint8Array): Promise<void>
  /**
   * Removes every stored current and previous save for a game. Its ROM and
   * hardware backups are kept.
   */
  discardSave(gameId: GameId): Promise<void>
  /** Days with a stored save file, as `YYYY-MM-DD`, oldest first. */
  listSaveDays(gameId: GameId): Promise<string[]>

  /**
   * Keeps the save read from a game cartridge just before PkCamp overwrites
   * it, as `hardware.sav` in today's folder. It is neither the current nor
   * the previous save, and a second backup on the same day replaces it.
   */
  putHardwareSave(gameId: GameId, bytes: Uint8Array): Promise<void>
  /** The newest hardware backup for a game, or null if none is stored. */
  getHardwareSave(gameId: GameId): Promise<StoredSave | null>

  getRom(gameId: GameId): Promise<StoredRom | null>
  putRom(gameId: GameId, rom: StoredRom): Promise<void>
  discardRom(gameId: GameId): Promise<void>

  /** A generation's Camp; a new generation has the default site count. */
  getCamp(generation: Generation): Promise<Camp>
  /** Replaces a generation's whole Camp. */
  saveCamp(generation: Generation, camp: Camp): Promise<void>

  getSettings(): Promise<StorageSettings>
  saveSettings(settings: StorageSettings): Promise<void>

  /**
   * Loads what the Camp Zone shows first (newest saves, Camps, settings)
   * ahead of use. Does nothing where reads are already fast.
   */
  prefetch(): Promise<void>
}

/**
 * The active provider cannot be reached (offline, expired session, API
 * error). Callers show `message` and keep the player's unsaved changes;
 * nothing falls back to another provider.
 */
export class StorageUnavailableError extends Error {
  readonly providerId: StorageProvider['id']

  constructor(providerId: StorageProvider['id'], message: string) {
    super(message)
    this.name = 'StorageUnavailableError'
    this.providerId = providerId
  }
}
