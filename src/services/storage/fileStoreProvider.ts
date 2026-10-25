import { i18n } from '../i18n'
import type { GameId, Generation } from '../saveLibrary'
import type { FileStore } from './fileStore'
import {
  CAMP_SITE_SIZE,
  DEFAULT_CAMP_SITE_COUNT,
  type Camp,
  type CampPokemon,
  type StorageProvider,
  type LabSettings,
  type StorageSettings,
  type StoredCollectionResult,
  type StoredRom,
  type StoredSave,
} from './types'

/*
 * Layout, identical for every provider:
 *
 *   settings.json
 *   saves/{gameId}/{YYYY-MM-DD}/current.sav
 *   saves/{gameId}/{YYYY-MM-DD}/previous.sav
 *   saves/{gameId}/{YYYY-MM-DD}/hardware.sav   cartridge save kept before
 *                                              overwriting the cartridge
 *   saves/{gameId}/{gameId}.{gba|gb|gbc|nds…}
 *   camp/gen-{n}/camp.json         site positions and file details
 *   camp/gen-{n}/{id}.pk{n}
 *   pokedex/{collectionId}.json    last scan result of one collection
 *   lab/settings.json              Lab preferences (scanned sources)
 *   lab/collections/{id}.json      an uploaded collection definition
 */

const SETTINGS_PATH = 'settings.json'
const CURRENT_SAVE = 'current.sav'
const PREVIOUS_SAVE = 'previous.sav'
const HARDWARE_SAVE = 'hardware.sav'
const POKEDEX_FOLDER = 'pokedex'
const LAB_FOLDER = 'lab'
const LAB_SETTINGS_PATH = 'lab/settings.json'
const LAB_COLLECTIONS_FOLDER = 'lab/collections'
const CAMP_MANIFEST = 'camp.json'
const CAMP_MANIFEST_VERSION = 1
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const SAFE_NAME = /^[A-Za-z0-9-]+$/

const DEFAULT_SETTINGS: StorageSettings = {
  spriteSourceId: null,
  themeId: null,
}

interface CampManifestEntry {
  id: string
  fileName: string
  importedAt: string
  sha256: string
}

interface CampManifest {
  version: number
  sites: (CampManifestEntry | null)[][]
}

/** The player's local calendar day, as `YYYY-MM-DD`. */
export function dayOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** An empty Camp with `siteCount` sites. */
export function emptyCamp(siteCount = DEFAULT_CAMP_SITE_COUNT): Camp {
  return {
    sites: Array.from({ length: siteCount }, () =>
      new Array<CampPokemon | null>(CAMP_SITE_SIZE).fill(null)
    ),
  }
}

function savesFolder(gameId: GameId): string {
  return `saves/${gameId}`
}

function campFolder(generation: Generation): string {
  return `camp/gen-${generation}`
}

function campFilePath(generation: Generation, id: string): string {
  return `${campFolder(generation)}/${id}.pk${generation}`
}

function collectionPath(collectionId: string): string {
  // The id becomes a file name, so it must not be able to leave the folder.
  if (!SAFE_NAME.test(collectionId)) {
    throw new Error(
      i18n.t('services:fileStoreProvider.invalidCollectionId', {
        collectionId: collectionId,
      })
    )
  }
  return `${POKEDEX_FOLDER}/${collectionId}.json`
}

function labCollectionPath(collectionId: string): string {
  // The id becomes a file name, so it must not be able to leave the folder.
  if (!SAFE_NAME.test(collectionId)) {
    throw new Error(
      i18n.t('services:fileStoreProvider.invalidCollectionId', {
        collectionId: collectionId,
      })
    )
  }
  return `${LAB_COLLECTIONS_FOLDER}/${collectionId}.json`
}

function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value, null, 2))
}

function decodeJson(bytes: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(bytes))
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice())
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * What the Camp Zone reads first, picked from every stored path: each
 * game's newest day's current and previous save, every Camp manifest and
 * Pokémon file, every collection result, the settings, and the Lab's
 * settings and uploaded collections. Older days and ROMs are left alone.
 */
export function prefetchPaths(paths: readonly string[]): string[] {
  const newestDay = new Map<string, string>()
  const picked: string[] = []
  for (const path of paths) {
    const parts = path.split('/')
    if (path === SETTINGS_PATH) picked.push(path)
    else if (parts[0] === POKEDEX_FOLDER && parts.length === 2)
      picked.push(path)
    else if (path === LAB_SETTINGS_PATH) picked.push(path)
    else if (
      parts[0] === LAB_FOLDER &&
      parts[1] === 'collections' &&
      parts.length === 3
    )
      picked.push(path)
    else if (parts[0] === 'camp' && parts.length === 3) picked.push(path)
    else if (
      parts[0] === 'saves' &&
      parts.length === 4 &&
      DAY_PATTERN.test(parts[2])
    ) {
      // A day with only a hardware backup is not the player's newest save.
      if (parts[3] !== CURRENT_SAVE) continue
      const newest = newestDay.get(parts[1])
      if (!newest || parts[2] > newest) newestDay.set(parts[1], parts[2])
    }
  }
  for (const [gameId, day] of newestDay) {
    for (const name of [CURRENT_SAVE, PREVIOUS_SAVE]) {
      const path = `saves/${gameId}/${day}/${name}`
      if (paths.includes(path)) picked.push(path)
    }
  }
  return picked
}

function validateCamp(camp: Camp): void {
  if (camp.sites.length < 1) {
    throw new RangeError(
      i18n.t('services:fileStoreProvider.aCampNeedsAtLeastOneCampSite')
    )
  }
  const ids = new Set<string>()
  for (const site of camp.sites) {
    if (site.length !== CAMP_SITE_SIZE) {
      throw new RangeError(
        i18n.t('services:fileStoreProvider.eachCampSiteHoldsExactlyPokeMon', {
          CAMP_SITE_SIZE: CAMP_SITE_SIZE,
        })
      )
    }
    for (const pokemon of site) {
      if (!pokemon) continue
      if (!SAFE_NAME.test(pokemon.id)) {
        throw new Error(
          i18n.t('services:fileStoreProvider.invalidCampPokeMonId', {
            id: pokemon.id,
          })
        )
      }
      if (ids.has(pokemon.id)) {
        throw new Error(
          i18n.t('services:fileStoreProvider.duplicateCampPokeMonId', {
            id: pokemon.id,
          })
        )
      }
      ids.add(pokemon.id)
    }
  }
}

/**
 * `StorageProvider` over any `FileStore`. All save-day, ROM, Camp, and
 * settings rules live here, so every provider stores data the same way and
 * only the file transport differs.
 */
export class FileStoreProvider implements StorageProvider {
  readonly id: StorageProvider['id']
  private readonly providerLabel: () => string

  get label(): string {
    return this.providerLabel()
  }
  private readonly store: FileStore
  private readonly now: () => Date

  constructor(
    store: FileStore,
    options: {
      id: StorageProvider['id']
      label: string
      /** Clock override for tests. */
      now?: () => Date
    }
  ) {
    this.store = store
    this.id = options.id
    this.providerLabel = () => options.label
    this.now = options.now ?? (() => new Date())
  }

  async prefetch(): Promise<void> {
    await this.store.prefetch?.(prefetchPaths)
  }

  async listSaveDays(gameId: GameId): Promise<string[]> {
    const entries = await this.store.list(savesFolder(gameId))
    return entries
      .filter(
        (entry) => entry.kind === 'folder' && DAY_PATTERN.test(entry.name)
      )
      .map((entry) => entry.name)
      .sort()
  }

  /**
   * The newest day that has a current save. A day can hold only a
   * `hardware.sav`, which is never the player's save.
   */
  private async newestSaveDay(gameId: GameId): Promise<string | null> {
    const days = await this.listSaveDays(gameId)
    for (const day of days.reverse()) {
      const files = await this.store.list(`${savesFolder(gameId)}/${day}`)
      if (files.some((entry) => entry.name === CURRENT_SAVE)) return day
    }
    return null
  }

  async getSave(gameId: GameId): Promise<StoredSave | null> {
    const day = await this.newestSaveDay(gameId)
    if (!day) return null
    const file = await this.store.read(
      `${savesFolder(gameId)}/${day}/${CURRENT_SAVE}`
    )
    return file ? { bytes: file.bytes, updatedAt: file.modified } : null
  }

  async hasSave(gameId: GameId): Promise<boolean> {
    return (await this.newestSaveDay(gameId)) !== null
  }

  async getPreviousSave(gameId: GameId): Promise<Uint8Array | null> {
    const day = await this.newestSaveDay(gameId)
    if (!day) return null
    const file = await this.store.read(
      `${savesFolder(gameId)}/${day}/${PREVIOUS_SAVE}`
    )
    return file?.bytes ?? null
  }

  async putSave(gameId: GameId, bytes: Uint8Array): Promise<void> {
    const now = this.now()
    const latest = await this.newestSaveDay(gameId)
    // A clock moved backwards must not hide the new save behind a later day.
    const day = latest && latest > dayOf(now) ? latest : dayOf(now)
    const folder = `${savesFolder(gameId)}/${day}`

    if (latest !== day) {
      // First change today: keep the latest earlier day's save as previous.
      const previous = await this.getSave(gameId)
      if (previous) {
        await this.store.write(
          `${folder}/${PREVIOUS_SAVE}`,
          previous.bytes,
          previous.updatedAt
        )
      }
    }
    await this.store.write(`${folder}/${CURRENT_SAVE}`, bytes, now)
  }

  async discardSave(gameId: GameId): Promise<void> {
    // Hardware backups are safety copies, so removing the save keeps them.
    for (const day of await this.listSaveDays(gameId)) {
      for (const name of [CURRENT_SAVE, PREVIOUS_SAVE]) {
        await this.store.delete(`${savesFolder(gameId)}/${day}/${name}`)
      }
    }
  }

  async putHardwareSave(gameId: GameId, bytes: Uint8Array): Promise<void> {
    const now = this.now()
    await this.store.write(
      `${savesFolder(gameId)}/${dayOf(now)}/${HARDWARE_SAVE}`,
      bytes,
      now
    )
  }

  async getHardwareSave(gameId: GameId): Promise<StoredSave | null> {
    for (const day of (await this.listSaveDays(gameId)).reverse()) {
      const file = await this.store.read(
        `${savesFolder(gameId)}/${day}/${HARDWARE_SAVE}`
      )
      if (file) return { bytes: file.bytes, updatedAt: file.modified }
    }
    return null
  }

  private async romFileNames(gameId: GameId): Promise<string[]> {
    const entries = await this.store.list(savesFolder(gameId))
    return entries
      .filter(
        (entry) => entry.kind === 'file' && entry.name.startsWith(`${gameId}.`)
      )
      .map((entry) => entry.name)
  }

  async getRom(gameId: GameId): Promise<StoredRom | null> {
    const [name] = await this.romFileNames(gameId)
    if (!name) return null
    const file = await this.store.read(`${savesFolder(gameId)}/${name}`)
    if (!file) return null
    return { bytes: file.bytes, extension: name.slice(gameId.length + 1) }
  }

  async hasRom(gameId: GameId): Promise<boolean> {
    return (await this.romFileNames(gameId)).length > 0
  }

  async putRom(gameId: GameId, rom: StoredRom): Promise<void> {
    const extension = rom.extension.replace(/^\./, '').toLowerCase()
    if (!/^[a-z0-9]+$/.test(extension)) {
      throw new Error(
        i18n.t('services:fileStoreProvider.invalidRomFileExtension', {
          extension: rom.extension,
        })
      )
    }
    const name = `${gameId}.${extension}`
    await this.store.write(`${savesFolder(gameId)}/${name}`, rom.bytes)
    for (const other of await this.romFileNames(gameId)) {
      if (other !== name)
        await this.store.delete(`${savesFolder(gameId)}/${other}`)
    }
  }

  async discardRom(gameId: GameId): Promise<void> {
    for (const name of await this.romFileNames(gameId)) {
      await this.store.delete(`${savesFolder(gameId)}/${name}`)
    }
  }

  private async readCampManifest(
    generation: Generation
  ): Promise<CampManifest | null> {
    const file = await this.store.read(
      `${campFolder(generation)}/${CAMP_MANIFEST}`
    )
    if (!file) return null
    const manifest = decodeJson(file.bytes) as CampManifest
    if (manifest.version !== CAMP_MANIFEST_VERSION) {
      throw new Error(
        i18n.t(
          'services:fileStoreProvider.campSitesWereSavedByANewerVersionOfPkcamp',
          { version: manifest.version }
        )
      )
    }
    // Positions are the Camp's meaning, so a manifest that does not hold
    // whole Camp Sites must not be read as one (it would shift every
    // position) or saved over.
    if (
      !Array.isArray(manifest.sites) ||
      manifest.sites.length < 1 ||
      manifest.sites.some(
        (site) => !Array.isArray(site) || site.length !== CAMP_SITE_SIZE
      )
    ) {
      throw new Error(
        i18n.t(
          'services:fileStoreProvider.theCampSitesFileIsDamagedAndCannotBeRead'
        )
      )
    }
    return manifest
  }

  async getCamp(generation: Generation): Promise<Camp> {
    const manifest = await this.readCampManifest(generation)
    if (!manifest) return emptyCamp()

    const sites = await Promise.all(
      manifest.sites.map((site) =>
        Promise.all(
          site.map(async (entry): Promise<CampPokemon | null> => {
            if (!entry) return null
            const file = await this.store.read(
              campFilePath(generation, entry.id)
            )
            if (!file) {
              console.error(
                i18n.t('services:fileStoreProvider.missingPokemonFile', {
                  id: entry.id,
                })
              )
              return null
            }
            return {
              id: entry.id,
              fileName: entry.fileName,
              importedAt: entry.importedAt,
              bytes: file.bytes,
            }
          })
        )
      )
    )
    return { sites }
  }

  async saveCamp(generation: Generation, camp: Camp): Promise<void> {
    validateCamp(camp)
    const previous = await this.readCampManifest(generation)
    const previousHashes = new Map(
      (previous?.sites.flat() ?? [])
        .filter((entry): entry is CampManifestEntry => entry !== null)
        .map((entry) => [entry.id, entry.sha256])
    )

    const sites = await Promise.all(
      camp.sites.map((site) =>
        Promise.all(
          site.map(async (pokemon): Promise<CampManifestEntry | null> => {
            if (!pokemon) return null
            return {
              id: pokemon.id,
              fileName: pokemon.fileName,
              importedAt: pokemon.importedAt,
              sha256: await sha256(pokemon.bytes),
            }
          })
        )
      )
    )

    // Write changed Pokémon first and the manifest last, so a failure part
    // way through leaves the previous Camp readable.
    const pokemonById = new Map(
      camp.sites
        .flat()
        .filter((pokemon): pokemon is CampPokemon => pokemon !== null)
        .map((pokemon) => [pokemon.id, pokemon])
    )
    const kept = new Set<string>()
    // A matching hash only proves the file is current if it is still there.
    const existing = new Set(
      (await this.store.list(campFolder(generation))).map((file) => file.name)
    )
    for (const entry of sites.flat()) {
      if (!entry) continue
      kept.add(entry.id)
      if (
        previousHashes.get(entry.id) === entry.sha256 &&
        existing.has(`${entry.id}.pk${generation}`)
      ) {
        continue
      }
      await this.store.write(
        campFilePath(generation, entry.id),
        pokemonById.get(entry.id)!.bytes
      )
    }
    const manifest: CampManifest = { version: CAMP_MANIFEST_VERSION, sites }
    await this.store.write(
      `${campFolder(generation)}/${CAMP_MANIFEST}`,
      encodeJson(manifest)
    )

    for (const entry of await this.store.list(campFolder(generation))) {
      if (entry.name === CAMP_MANIFEST) continue
      const id = entry.name.replace(/\.pk\d+$/, '')
      if (!kept.has(id)) {
        await this.store.delete(`${campFolder(generation)}/${entry.name}`)
      }
    }
  }

  async getCollectionResult(
    collectionId: string
  ): Promise<StoredCollectionResult | null> {
    const file = await this.store.read(collectionPath(collectionId))
    if (!file) return null
    // A result is only a cache of a scan, so anything unreadable is treated
    // as missing and the Lab rescans.
    let stored: Partial<StoredCollectionResult> | null
    try {
      stored = decodeJson(file.bytes) as Partial<StoredCollectionResult> | null
    } catch {
      return null
    }
    if (
      typeof stored !== 'object' ||
      stored === null ||
      stored.version !== 2 ||
      stored.collectionId !== collectionId
    ) {
      return null
    }
    return stored as StoredCollectionResult
  }

  async putCollectionResult(result: StoredCollectionResult): Promise<void> {
    await this.store.write(
      collectionPath(result.collectionId),
      encodeJson(result)
    )
  }

  async discardCollectionResult(collectionId: string): Promise<void> {
    await this.store.delete(collectionPath(collectionId))
  }

  async getSettings(): Promise<StorageSettings> {
    const file = await this.store.read(SETTINGS_PATH)
    if (!file) return { ...DEFAULT_SETTINGS }
    const stored = decodeJson(file.bytes) as Partial<StorageSettings> | null
    const spriteSourceId = stored?.spriteSourceId
    const themeId = stored?.themeId
    return {
      ...DEFAULT_SETTINGS,
      ...(typeof spriteSourceId === 'string' ? { spriteSourceId } : {}),
      ...(typeof themeId === 'string' ? { themeId } : {}),
    }
  }

  async saveSettings(settings: StorageSettings): Promise<void> {
    await this.store.write(
      SETTINGS_PATH,
      encodeJson({
        spriteSourceId: settings.spriteSourceId ?? null,
        themeId: settings.themeId ?? null,
      })
    )
  }

  async getLabSettings(): Promise<LabSettings> {
    const file = await this.store.read(LAB_SETTINGS_PATH)
    if (!file) return { sources: null }
    let stored: unknown
    try {
      stored = decodeJson(file.bytes)
    } catch {
      return { sources: null }
    }
    const sources = (stored as Partial<LabSettings> | null)?.sources
    return {
      sources:
        Array.isArray(sources) &&
        sources.every((source) => typeof source === 'string')
          ? sources
          : null,
    }
  }

  async saveLabSettings(settings: LabSettings): Promise<void> {
    await this.store.write(
      LAB_SETTINGS_PATH,
      encodeJson({ sources: settings.sources })
    )
  }

  async listLabCollections(): Promise<unknown[]> {
    const entries = await this.store.list(LAB_COLLECTIONS_FOLDER)
    const definitions: unknown[] = []
    for (const entry of entries) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
      const file = await this.store.read(
        `${LAB_COLLECTIONS_FOLDER}/${entry.name}`
      )
      if (!file) continue
      try {
        definitions.push(decodeJson(file.bytes))
      } catch {
        // Not JSON: the Lab can't use it, and other files still load.
      }
    }
    return definitions
  }

  async putLabCollection(
    collectionId: string,
    definition: unknown
  ): Promise<void> {
    await this.store.write(
      labCollectionPath(collectionId),
      encodeJson(definition)
    )
  }

  async discardLabCollection(collectionId: string): Promise<void> {
    await this.store.delete(labCollectionPath(collectionId))
  }
}
