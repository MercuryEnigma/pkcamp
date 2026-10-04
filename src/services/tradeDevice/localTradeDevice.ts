import type { PokemonSaveAdapter, SaveGame } from '../pkhex'
import type { Gen3GameId } from '../saveLibrary'
import { storage } from '../storage'
import {
  TradeDeviceError,
  type TradeDevice,
  type TradeDeviceState,
  type TradeRequest,
  type TradeResult,
} from './types.ts'

const GENERATION = 3 as const

/** One box slot in a stored save backup. */
export interface SaveSlot {
  gameId: Gen3GameId
  box: number
  index: number
}

/** One Camp Sites position. */
export interface CampSlot {
  site: number
  index: number
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function pokemonFileName(
  pokemon: ReturnType<PokemonSaveAdapter['importPokemonFile']>
): string {
  const base = (pokemon.nickname || `pokemon-${pokemon.species}`)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${base || `pokemon-${pokemon.species}`}.pk3`
}

/**
 * Save backups and Camp Sites are always available: there is nothing to
 * connect, and their trades run through `runTrade`, not `trade()`.
 */
abstract class LocalTradeDevice implements TradeDevice {
  abstract readonly id: 'save-backup' | 'camp-site'
  abstract readonly label: string
  readonly implemented = true
  readonly supported = true
  readonly state: TradeDeviceState = 'connected'

  connect(): Promise<void> {
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    return Promise.resolve()
  }

  trade(_request: TradeRequest): Promise<TradeResult> {
    return Promise.reject(
      new TradeDeviceError(
        this.id,
        'invalid-party',
        `${this.label} trades run through runTrade.`
      )
    )
  }

  offerSlot(_slot: number): void {}

  declineTrade(): void {}

  cancelTrade(): void {}
}

export class SaveBackupTradeDevice extends LocalTradeDevice {
  readonly id = 'save-backup'
  readonly label = 'Save backup'

  /**
   * Re-reads the persisted save and checks the slot still holds `expected`,
   * so a stale selection can never overwrite a different Pokémon.
   */
  private async withSlot<T>(
    adapter: PokemonSaveAdapter,
    slot: SaveSlot,
    expected: Uint8Array,
    access: (game: SaveGame) => T
  ): Promise<T> {
    const bytes = (await storage.getSave(slot.gameId))?.bytes
    if (!bytes) throw new Error('The selected backup is no longer stored.')
    const game = adapter.load(bytes)
    try {
      const current = game.boxes[slot.box]?.slots[slot.index]
      if (!current) throw new Error('The selected backup slot is now empty.')
      if (!bytesEqual(adapter.exportPokemonFile(current), expected)) {
        throw new Error('The selected backup slot changed before the trade.')
      }
      return access(game)
    } finally {
      game.dispose()
    }
  }

  write(
    adapter: PokemonSaveAdapter,
    slot: SaveSlot,
    expected: Uint8Array,
    received: Uint8Array
  ): Promise<void> {
    return this.withSlot(adapter, slot, expected, (game) => {
      game.setBoxSlot(
        { box: slot.box, slot: slot.index },
        adapter.importPokemonFile(received)
      )
      return game.toBytes()
    }).then((bytes) => storage.putSave(slot.gameId, bytes))
  }

  /** First other occupied box slot, then the first party Pokémon. */
  companion(
    adapter: PokemonSaveAdapter,
    slot: SaveSlot,
    expected: Uint8Array
  ): Promise<Uint8Array | null> {
    return this.withSlot(adapter, slot, expected, (game) => {
      for (const [boxIndex, box] of game.boxes.entries()) {
        for (const [slotIndex, pokemon] of box.slots.entries()) {
          if (pokemon && (boxIndex !== slot.box || slotIndex !== slot.index)) {
            return adapter.exportPokemonFile(pokemon)
          }
        }
      }
      const partyPokemon = game.party.find((pokemon) => pokemon !== null)
      return partyPokemon ? adapter.exportPokemonFile(partyPokemon) : null
    })
  }
}

export class CampSiteTradeDevice extends LocalTradeDevice {
  readonly id = 'camp-site'
  readonly label = 'Camp Sites'

  private async findSlot(slot: CampSlot, expected: Uint8Array) {
    const camp = await storage.getCamp(GENERATION)
    const current = camp.sites[slot.site]?.[slot.index]
    if (!current) {
      throw new Error('The selected Camp Site position is now empty.')
    }
    if (!bytesEqual(current.bytes, expected)) {
      throw new Error('The selected Camp Site slot changed before the trade.')
    }
    return { camp, current }
  }

  async write(
    adapter: PokemonSaveAdapter,
    slot: CampSlot,
    expected: Uint8Array,
    received: Uint8Array
  ): Promise<void> {
    const pokemon = adapter.importPokemonFile(received)
    const { camp, current } = await this.findSlot(slot, expected)
    camp.sites[slot.site][slot.index] = {
      ...current,
      bytes: received.slice(),
      fileName: pokemonFileName(pokemon),
      importedAt: new Date().toISOString(),
    }
    await storage.saveCamp(GENERATION, camp)
  }

  /** First other occupied Camp Sites file. */
  async companion(
    _adapter: PokemonSaveAdapter,
    slot: CampSlot,
    expected: Uint8Array
  ): Promise<Uint8Array | null> {
    const { camp, current } = await this.findSlot(slot, expected)
    for (const site of camp.sites) {
      for (const entry of site) {
        if (entry && entry.id !== current.id) return entry.bytes.slice()
      }
    }
    return null
  }
}
