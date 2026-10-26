import { i18n } from '../i18n'
import type {
  BoxLocation,
  PokemonMove,
  PokemonNode,
  PokemonSaveAdapter,
  SaveGame,
} from '../pkhex'
import type { Gen3GameId } from '../saveLibrary'
import {
  CAMP_SITE_SIZE,
  DEFAULT_CAMP_SITE_COUNT,
  type Camp,
  type CampPokemon,
  type CampPosition,
  type StorageProvider,
  type StoredSave,
} from '../storage'

export type ActiveGameStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface ActiveGameSnapshot {
  status: ActiveGameStatus
  provider: StorageProvider | null
  gameId: Gen3GameId | null
  /** The working copy. Mutations are made through this service. */
  save: SaveGame | null
  /** The last successfully persisted save bytes. */
  saveBytes: Uint8Array | null
  saveUpdatedAt: Date | null
  /** The working Camp copy. */
  camp: Camp | null
  saveDirty: boolean
  campDirty: boolean
  dirty: boolean
  revision: number
  error: Error | null
}

export type ActiveGameChangeKind = 'save' | 'camp' | 'save-discarded'

export interface ActiveGameChange {
  kind: ActiveGameChangeKind
  provider: StorageProvider
  gameId: Gen3GameId | null
  revision: number
}

export interface CommitPart {
  status: 'unchanged' | 'saved' | 'failed'
  error?: Error
}

export interface ActiveGameCommitResult {
  save: CommitPart
  camp: CommitPart
}

export interface CommittedActiveGameView {
  gameId: Gen3GameId | null
  save: SaveGame | null
  saveUpdatedAt: Date | null
  camp: Camp
  adapter: PokemonSaveAdapter
}

const INITIAL_SNAPSHOT: ActiveGameSnapshot = Object.freeze({
  status: 'idle',
  provider: null,
  gameId: null,
  save: null,
  saveBytes: null,
  saveUpdatedAt: null,
  camp: null,
  saveDirty: false,
  campDirty: false,
  dirty: false,
  revision: 0,
  error: null,
})

const EXPECTED_VERSION: Readonly<
  Record<Gen3GameId, SaveGame['version']['exact']>
> = {
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
  firered: 'FireRed',
  leafgreen: 'LeafGreen',
}

const GAME_LABEL: Readonly<Record<Gen3GameId, string>> = {
  ruby: 'Pokémon Ruby',
  sapphire: 'Pokémon Sapphire',
  emerald: 'Pokémon Emerald',
  firered: 'Pokémon FireRed',
  leafgreen: 'Pokémon LeafGreen',
}

function cloneCamp(camp: Camp): Camp {
  return structuredClone(camp)
}

function errorFrom(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

function assertSaveMatchesGame(
  gameId: Gen3GameId,
  save: Pick<SaveGame, 'version'>
): void {
  const exact = save.version.exact
  const rubyOrSapphire = gameId === 'ruby' || gameId === 'sapphire'
  if (
    exact !== EXPECTED_VERSION[gameId] &&
    !(exact === 'RubySapphire' && rubyOrSapphire)
  ) {
    throw new Error(
      i18n.t('services:activeGame.thisIsASaveNotASave', {
        aggregated: save.version.aggregated,
        value2: GAME_LABEL[gameId],
      })
    )
  }
}

function assertCampPosition(camp: Camp, position: CampPosition): void {
  if (
    !Number.isInteger(position.site) ||
    !Number.isInteger(position.index) ||
    position.site < 0 ||
    position.site >= camp.sites.length ||
    position.index < 0 ||
    position.index >= CAMP_SITE_SIZE
  ) {
    throw new RangeError(
      i18n.t('services:activeGame.theCampPositionIsOutOfBounds')
    )
  }
}

function minimumCampSiteCount(camp: Camp): number {
  let lastOccupied = -1
  for (const [index, site] of camp.sites.entries()) {
    if (site.some((pokemon) => pokemon !== null)) lastOccupied = index
  }
  return Math.max(1, lastOccupied + 1)
}

/** Owns the selected save and Camp committed baselines and working copies. */
export class ActiveGameService {
  private snapshot: ActiveGameSnapshot = INITIAL_SNAPSHOT
  private readonly listeners = new Set<() => void>()
  private readonly changeListeners = new Set<
    (change: ActiveGameChange) => void
  >()
  private loadVersion = 0
  private pending: Promise<void> | null = null
  private adapter: PokemonSaveAdapter | null = null
  private committedCamp: Camp | null = null
  private saveEditVersion = 0
  private campEditVersion = 0
  private campPokemonSequence = 0

  getSnapshot = (): ActiveGameSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  subscribeChanges = (
    listener: (change: ActiveGameChange) => void
  ): (() => void) => {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  select(
    gameId: Gen3GameId | null,
    provider: StorageProvider,
    adapter: PokemonSaveAdapter
  ): Promise<void> {
    if (
      this.snapshot.provider === provider &&
      this.snapshot.gameId === gameId &&
      this.adapter === adapter
    ) {
      if (this.snapshot.status === 'ready') return Promise.resolve()
      if (this.snapshot.status === 'loading' && this.pending)
        return this.pending
    }

    const version = ++this.loadVersion
    this.pending = null
    this.disposeSave()
    this.committedCamp = null
    this.saveEditVersion = 0
    this.campEditVersion = 0
    this.adapter = adapter
    this.publish({
      ...INITIAL_SNAPSHOT,
      status: 'loading',
      provider,
      gameId,
      revision: this.snapshot.revision,
    })

    const pending = Promise.all([
      gameId ? provider.getSave(gameId) : Promise.resolve(null),
      provider.getCamp(3),
    ])
      .then(([stored, camp]) => {
        let save: SaveGame | null = null
        try {
          if (stored) {
            save = adapter.load(stored.bytes)
            assertSaveMatchesGame(gameId as Gen3GameId, save)
          }
        } catch (cause) {
          save?.dispose()
          throw cause
        }
        if (version !== this.loadVersion) {
          save?.dispose()
          return
        }
        this.pending = null
        this.committedCamp = cloneCamp(camp)
        this.publish({
          status: 'ready',
          provider,
          gameId,
          save,
          saveBytes: stored?.bytes.slice() ?? null,
          saveUpdatedAt: stored?.updatedAt ?? null,
          camp: cloneCamp(camp),
          saveDirty: false,
          campDirty: false,
          dirty: false,
          revision: this.snapshot.revision + 1,
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (version !== this.loadVersion) return
        this.pending = null
        this.committedCamp = null
        this.publish({
          ...INITIAL_SNAPSHOT,
          status: 'error',
          provider,
          gameId,
          revision: this.snapshot.revision,
          error: errorFrom(cause),
        })
        throw cause
      })
    this.pending = pending
    return pending
  }

  movePokemon(from: BoxLocation, to: BoxLocation): void {
    this.editSave((save) => save.movePokemon(from, to))
  }

  movePokemonGroup(moves: readonly PokemonMove[]): void {
    this.editSave((save) => save.movePokemonGroup(moves))
  }

  setBoxSlot(location: BoxLocation, pokemon: PokemonNode | null): void {
    this.editSave((save) => save.setBoxSlot(location, pokemon))
  }

  importPokemon(bytes: Uint8Array): PokemonNode {
    this.requireReady()
    if (!this.adapter)
      throw new Error(i18n.t('services:activeGame.theSaveAdapterIsUnavailable'))
    return this.adapter.importPokemonFile(bytes)
  }

  exportPokemon(pokemon: PokemonNode): Uint8Array {
    this.requireReady()
    if (!this.adapter)
      throw new Error(i18n.t('services:activeGame.theSaveAdapterIsUnavailable'))
    return this.adapter.exportPokemonFile(pokemon)
  }

  editSave(mutator: (save: SaveGame) => void): void {
    const { save } = this.requireReady()
    if (!save)
      throw new Error(
        i18n.t('services:activeGame.theActiveGameHasNoSaveToEdit')
      )
    mutator(save)
    this.saveEditVersion += 1
    this.publishDirty({ saveDirty: true })
  }

  editCamp(mutator: (camp: Camp) => void): void {
    const { camp } = this.requireReady()
    if (!camp)
      throw new Error(i18n.t('services:activeGame.theActiveCampIsUnavailable'))
    mutator(camp)
    this.campEditVersion += 1
    this.publishDirty({ campDirty: true })
  }

  replaceCampDraft(camp: Camp): void {
    this.requireReady()
    this.campEditVersion += 1
    this.publish({
      ...this.snapshot,
      camp: cloneCamp(camp),
      campDirty: true,
      dirty: true,
      revision: this.snapshot.revision + 1,
      error: null,
    })
  }

  setCampSlot(position: CampPosition, pokemon: CampPokemon | null): void {
    this.editCamp((camp) => {
      assertCampPosition(camp, position)
      camp.sites[position.site][position.index] = pokemon
    })
  }

  moveCampPokemon(from: CampPosition, to: CampPosition): void {
    this.editCamp((camp) => {
      assertCampPosition(camp, from)
      assertCampPosition(camp, to)
      if (from.site === to.site && from.index === to.index) return
      const source = camp.sites[from.site][from.index]
      if (!source)
        throw new Error(
          i18n.t('services:activeGame.cannotMoveAnEmptyCampPosition')
        )
      const destination = camp.sites[to.site][to.index]
      camp.sites[to.site][to.index] = source
      camp.sites[from.site][from.index] = destination
    })
  }

  resizeCamp(siteCount: number): void {
    this.editCamp((camp) => {
      const requested = Number.isSafeInteger(siteCount)
        ? Math.min(Math.max(1, siteCount), 1000)
        : DEFAULT_CAMP_SITE_COUNT
      const count = Math.max(requested, minimumCampSiteCount(camp))
      camp.sites = Array.from({ length: count }, (_, index) =>
        camp.sites[index]
          ? [...camp.sites[index]]
          : new Array<CampPokemon | null>(CAMP_SITE_SIZE).fill(null)
      )
    })
  }

  clearCamp(): void {
    this.editCamp((camp) => {
      camp.sites = camp.sites.map(() =>
        new Array<CampPokemon | null>(CAMP_SITE_SIZE).fill(null)
      )
    })
  }

  /** Swaps a boxed Pokémon with a Camp position as one draft operation. */
  moveSavePokemonToCamp(from: BoxLocation, to: CampPosition): void {
    const current = this.requireReady()
    if (!current.save || !current.camp || !this.adapter)
      throw new Error(
        i18n.t('services:activeGame.aSelectedSaveAndCampAreRequired')
      )
    assertCampPosition(current.camp, to)
    const source = current.save.boxes[from.box]?.slots[from.slot]
    if (!source)
      throw new Error(i18n.t('services:activeGame.cannotMoveAnEmptyBoxSlot'))
    const destinationFile = current.camp.sites[to.site][to.index]
    const destination = destinationFile
      ? this.adapter.importPokemonFile(destinationFile.bytes)
      : null
    const file: CampPokemon = {
      id: `camp-${Date.now()}-${++this.campPokemonSequence}`,
      fileName: `${source.nickname || `pokemon-${source.species}`}.pk3`,
      bytes: this.adapter.exportPokemonFile(source),
      importedAt: new Date().toISOString(),
    }
    current.save.setBoxSlot(from, destination)
    current.camp.sites[to.site][to.index] = file
    this.markBothDirty()
  }

  /** Swaps a Camp Pokémon with a boxed position as one draft operation. */
  moveCampPokemonToSave(from: CampPosition, to: BoxLocation): void {
    const current = this.requireReady()
    if (!current.save || !current.camp || !this.adapter)
      throw new Error(
        i18n.t('services:activeGame.aSelectedSaveAndCampAreRequired')
      )
    assertCampPosition(current.camp, from)
    const sourceFile = current.camp.sites[from.site][from.index]
    if (!sourceFile)
      throw new Error(
        i18n.t('services:activeGame.cannotMoveAnEmptyCampPosition')
      )
    const source = this.adapter.importPokemonFile(sourceFile.bytes)
    const destination = current.save.boxes[to.box]?.slots[to.slot]
    const destinationFile: CampPokemon | null = destination
      ? {
          id: `camp-${Date.now()}-${++this.campPokemonSequence}`,
          fileName: `${destination.nickname || `pokemon-${destination.species}`}.pk3`,
          bytes: this.adapter.exportPokemonFile(destination),
          importedAt: new Date().toISOString(),
        }
      : null
    current.save.setBoxSlot(to, source)
    current.camp.sites[from.site][from.index] = destinationFile
    this.markBothDirty()
  }

  /** Restores working copies from memory without another storage read. */
  discardDraft(): void {
    const current = this.requireReady()
    let save = current.save
    if (current.saveDirty) {
      if (!this.adapter)
        throw new Error(
          i18n.t('services:activeGame.theSaveAdapterIsUnavailable')
        )
      const replacement = current.saveBytes
        ? this.adapter.load(current.saveBytes)
        : null
      if (replacement && current.gameId)
        assertSaveMatchesGame(current.gameId, replacement)
      save?.dispose()
      save = replacement
    }
    this.saveEditVersion += 1
    this.campEditVersion += 1
    this.publish({
      ...current,
      save,
      camp: this.committedCamp ? cloneCamp(this.committedCamp) : null,
      saveDirty: false,
      campDirty: false,
      dirty: false,
      revision: current.revision + 1,
      error: null,
    })
  }

  /** Writes dirty resources independently; a failed part remains dirty. */
  async commitDraft(): Promise<ActiveGameCommitResult> {
    const current = this.requireReady()
    const selectionVersion = this.loadVersion
    const saveEditVersion = this.saveEditVersion
    const campEditVersion = this.campEditVersion
    const saveBytes = current.saveDirty
      ? (current.save?.toBytes() ?? null)
      : null
    const camp =
      current.campDirty && current.camp ? cloneCamp(current.camp) : null
    const [save, campResult] = await Promise.all([
      this.commitSavePart(
        current,
        saveBytes,
        selectionVersion,
        saveEditVersion
      ),
      this.commitCampPart(current, camp, selectionVersion, campEditVersion),
    ])
    return { save, camp: campResult }
  }

  /** Compatibility helper for save-only callers. */
  async save(): Promise<void> {
    const current = this.requireReady()
    if (!current.gameId || !current.save)
      throw new Error(
        i18n.t('services:activeGame.theActiveGameHasNoSaveToWrite')
      )
    if (!current.saveDirty) {
      this.saveEditVersion += 1
      this.publishDirty({ saveDirty: true })
    }
    const result = await this.commitDraft()
    if (result.save.status === 'failed') throw result.save.error
  }

  /** Validates and persists bytes before replacing the working save. */
  async replaceSave(bytes: Uint8Array): Promise<void> {
    const current = this.requireReady()
    if (!current.gameId || !this.adapter)
      throw new Error(
        i18n.t('services:activeGame.selectAGameBeforeReplacingItsSave')
      )
    const replacement = this.adapter.load(bytes)
    try {
      assertSaveMatchesGame(current.gameId, replacement)
      const version = this.loadVersion
      await current.provider.putSave(current.gameId, bytes)
      if (version !== this.loadVersion) {
        replacement.dispose()
        return
      }
      current.save?.dispose()
      this.saveEditVersion += 1
      this.publish({
        ...this.snapshot,
        save: replacement,
        saveBytes: bytes.slice(),
        saveUpdatedAt: new Date(),
        saveDirty: false,
        dirty: this.snapshot.campDirty,
        revision: this.snapshot.revision + 1,
        error: null,
      })
      this.emitChange('save', current.provider, current.gameId)
    } catch (cause) {
      replacement.dispose()
      throw cause
    }
  }

  restoreSave(bytes: Uint8Array): Promise<void> {
    return this.replaceSave(bytes)
  }

  async discardSave(): Promise<void> {
    const current = this.requireReady()
    if (!current.gameId)
      throw new Error(i18n.t('services:activeGame.noActiveSaveIsSelected'))
    const version = this.loadVersion
    await current.provider.discardSave(current.gameId)
    if (version !== this.loadVersion) return
    current.save?.dispose()
    this.saveEditVersion += 1
    this.publish({
      ...this.snapshot,
      save: null,
      saveBytes: null,
      saveUpdatedAt: null,
      saveDirty: false,
      dirty: this.snapshot.campDirty,
      revision: this.snapshot.revision + 1,
      error: null,
    })
    this.emitChange('save-discarded', current.provider, current.gameId)
  }

  /** Writes a complete Camp immediately for import/settings workflows. */
  async replaceCamp(camp: Camp): Promise<void> {
    const current = this.requireReady()
    const version = this.loadVersion
    const copy = cloneCamp(camp)
    await current.provider.saveCamp(3, copy)
    if (version !== this.loadVersion) return
    this.committedCamp = cloneCamp(copy)
    this.campEditVersion += 1
    this.publish({
      ...this.snapshot,
      camp: cloneCamp(copy),
      campDirty: false,
      dirty: this.snapshot.saveDirty,
      revision: this.snapshot.revision + 1,
      error: null,
    })
    this.emitChange('camp', current.provider, current.gameId)
  }

  readSecondarySave(gameId: Gen3GameId): Promise<StoredSave | null> {
    return this.requireReady().provider.getSave(gameId)
  }

  /** Reads the committed baseline and disposes its temporary parsed save. */
  readCommitted<T>(reader: (view: CommittedActiveGameView) => T): T {
    const current = this.requireReady()
    if (!this.adapter || !this.committedCamp)
      throw new Error(
        'The committed active game is unavailable.'
      )
    const save = current.saveBytes ? this.adapter.load(current.saveBytes) : null
    try {
      return reader({
        gameId: current.gameId,
        save,
        saveUpdatedAt: current.saveUpdatedAt,
        camp: cloneCamp(this.committedCamp),
        adapter: this.adapter,
      })
    } finally {
      save?.dispose()
    }
  }

  async writeSecondarySave(
    gameId: Gen3GameId,
    bytes: Uint8Array
  ): Promise<void> {
    const current = this.requireReady()
    if (!this.adapter)
      throw new Error(i18n.t('services:activeGame.theSaveAdapterIsUnavailable'))
    const parsed = this.adapter.load(bytes)
    try {
      assertSaveMatchesGame(gameId, parsed)
    } finally {
      parsed.dispose()
    }
    await current.provider.putSave(gameId, bytes)
    this.emitChange('save', current.provider, gameId)
  }

  async discardSecondarySave(gameId: Gen3GameId): Promise<void> {
    const current = this.requireReady()
    if (current.gameId === gameId) {
      await this.discardSave()
      return
    }
    await current.provider.discardSave(gameId)
    this.emitChange('save-discarded', current.provider, gameId)
  }

  /** Explicit fresh-read semantic used by Arcade conflict checks. */
  readPersistedSaveFresh(gameId: Gen3GameId): Promise<StoredSave | null> {
    return this.requireReady().provider.getSave(gameId)
  }

  clear(): void {
    ++this.loadVersion
    this.pending = null
    this.adapter = null
    this.committedCamp = null
    this.saveEditVersion = 0
    this.campEditVersion = 0
    this.disposeSave()
    this.publish({ ...INITIAL_SNAPSHOT, revision: this.snapshot.revision + 1 })
  }

  private async commitSavePart(
    current: ActiveGameSnapshot & { provider: StorageProvider },
    bytes: Uint8Array | null,
    selectionVersion: number,
    editVersion: number
  ): Promise<CommitPart> {
    if (!current.saveDirty) return { status: 'unchanged' }
    if (!current.gameId || !bytes)
      return {
        status: 'failed',
        error: new Error(
          i18n.t('services:activeGame.theActiveGameHasNoSaveToWrite')
        ),
      }
    try {
      await current.provider.putSave(current.gameId, bytes)
      if (selectionVersion !== this.loadVersion) return { status: 'saved' }
      const stillCurrent = editVersion === this.saveEditVersion
      this.publish({
        ...this.snapshot,
        saveBytes: bytes.slice(),
        saveUpdatedAt: new Date(),
        saveDirty: stillCurrent ? false : this.snapshot.saveDirty,
        dirty: stillCurrent
          ? this.snapshot.campDirty
          : this.snapshot.saveDirty || this.snapshot.campDirty,
        revision: this.snapshot.revision + 1,
        error: null,
      })
      this.emitChange('save', current.provider, current.gameId)
      return { status: 'saved' }
    } catch (cause) {
      return { status: 'failed', error: errorFrom(cause) }
    }
  }

  private async commitCampPart(
    current: ActiveGameSnapshot & { provider: StorageProvider },
    camp: Camp | null,
    selectionVersion: number,
    editVersion: number
  ): Promise<CommitPart> {
    if (!current.campDirty) return { status: 'unchanged' }
    if (!camp)
      return {
        status: 'failed',
        error: new Error(i18n.t('services:activeGame.theCampIsUnavailable')),
      }
    try {
      await current.provider.saveCamp(3, camp)
      if (selectionVersion !== this.loadVersion) return { status: 'saved' }
      this.committedCamp = cloneCamp(camp)
      const stillCurrent = editVersion === this.campEditVersion
      this.publish({
        ...this.snapshot,
        campDirty: stillCurrent ? false : this.snapshot.campDirty,
        dirty: stillCurrent
          ? this.snapshot.saveDirty
          : this.snapshot.saveDirty || this.snapshot.campDirty,
        revision: this.snapshot.revision + 1,
        error: null,
      })
      this.emitChange('camp', current.provider, current.gameId)
      return { status: 'saved' }
    } catch (cause) {
      return { status: 'failed', error: errorFrom(cause) }
    }
  }

  private requireReady(): ActiveGameSnapshot & { provider: StorageProvider } {
    if (this.snapshot.status !== 'ready' || !this.snapshot.provider) {
      throw new Error(i18n.t('services:activeGame.theActiveGameIsNotReady'))
    }
    return this.snapshot as ActiveGameSnapshot & { provider: StorageProvider }
  }

  private publishDirty(change: {
    saveDirty?: boolean
    campDirty?: boolean
  }): void {
    const saveDirty = change.saveDirty ?? this.snapshot.saveDirty
    const campDirty = change.campDirty ?? this.snapshot.campDirty
    this.publish({
      ...this.snapshot,
      saveDirty,
      campDirty,
      dirty: saveDirty || campDirty,
      revision: this.snapshot.revision + 1,
      error: null,
    })
  }

  private markBothDirty(): void {
    this.saveEditVersion += 1
    this.campEditVersion += 1
    this.publish({
      ...this.snapshot,
      saveDirty: true,
      campDirty: true,
      dirty: true,
      revision: this.snapshot.revision + 1,
      error: null,
    })
  }

  private emitChange(
    kind: ActiveGameChangeKind,
    provider: StorageProvider,
    gameId: Gen3GameId | null
  ): void {
    const change = { kind, provider, gameId, revision: this.snapshot.revision }
    for (const listener of this.changeListeners) listener(change)
  }

  private disposeSave(): void {
    this.snapshot.save?.dispose()
  }

  private publish(snapshot: ActiveGameSnapshot): void {
    this.snapshot = Object.freeze(snapshot)
    for (const listener of this.listeners) listener()
  }
}

export const activeGame = new ActiveGameService()
