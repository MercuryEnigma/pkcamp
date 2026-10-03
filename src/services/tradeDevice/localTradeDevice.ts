import { localPokemonLibrary } from '../localPokemonLibrary'
import type { PokemonSaveAdapter, SaveGame } from '../pkhex'
import { saveLibrary, type Gen3GameId } from '../saveLibrary'
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

/** One Camp Sites file, identified by its stable id. */
export interface CampSlot {
  id: string
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
    await saveLibrary.whenReady()
    const bytes = saveLibrary.getSave(slot.gameId)
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
      saveLibrary.updateSave(slot.gameId, game.toBytes())
    })
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
    const slots = await localPokemonLibrary.getSlots(GENERATION)
    const index = slots.findIndex((entry) => entry?.id === slot.id)
    const current = slots[index]
    if (!current) {
      throw new Error('The selected Camp Site Pokémon is no longer stored.')
    }
    if (!bytesEqual(current.bytes, expected)) {
      throw new Error('The selected Camp Site slot changed before the trade.')
    }
    return { slots, index, current }
  }

  async write(
    adapter: PokemonSaveAdapter,
    slot: CampSlot,
    expected: Uint8Array,
    received: Uint8Array
  ): Promise<void> {
    const pokemon = adapter.importPokemonFile(received)
    const { slots, index, current } = await this.findSlot(slot, expected)
    slots[index] = {
      ...current,
      bytes: received.slice(),
      fileName: pokemonFileName(pokemon),
      importedAt: new Date().toISOString(),
    }
    await localPokemonLibrary.saveSlots(GENERATION, slots)
  }

  /** First other occupied Camp Sites file. */
  async companion(
    _adapter: PokemonSaveAdapter,
    slot: CampSlot,
    expected: Uint8Array
  ): Promise<Uint8Array | null> {
    const { slots } = await this.findSlot(slot, expected)
    const other = slots.find((entry) => entry && entry.id !== slot.id)
    return other ? other.bytes.slice() : null
  }
}
