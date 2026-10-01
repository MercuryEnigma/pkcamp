import type {
  Game,
  ItemInfo,
  LookupTable,
  Pokemon,
  StatBlock,
  TrainerInfo,
} from './gen/types.ts'
import type { PkHexApiExports } from './pkhex.ts'
import { PokemonHandle } from './pokemon.ts'
import { itemsForGeneration } from './tables.ts'

/** Wire order of stat arrays across the Binding: [HP, Atk, Def, Spe, SpA, SpD]. */
export const WIRE_ORDER = [0, 1, 2, 3, 4, 5] as const

export function displayToWire(display: StatBlock): number[] {
  return [
    display.health,
    display.attack,
    display.defense,
    display.speed,
    display.specialAttack,
    display.specialDefense,
  ]
}

export function wireToDisplay(wire: ArrayLike<number>): StatBlock {
  return {
    health: wire[0],
    attack: wire[1],
    defense: wire[2],
    speed: wire[3],
    specialAttack: wire[4],
    specialDefense: wire[5],
  }
}

/**
 * Write-through Handle over one parsed save file.
 *
 * Snapshot accessors (`box`, `party`) materialize entity Handles on demand.
 */
export class GameHandle implements Game {
  readonly #api: PkHexApiExports
  readonly #handle: number

  constructor(handle: number, api: PkHexApiExports) {
    this.#api = api
    this.#handle = handle
  }

  /** Numeric wasm-side handle (internal plumbing for the root's saveBytes). */
  static handleOf(game: Game): number {
    return (game as GameHandle).#handle
  }

  get trainer(): TrainerInfo {
    return {
      name: this.#api.GameTrainerName(this.#handle),
      id: {
        tid: this.#api.GameTrainerId(this.#handle),
        sid: this.#api.GameTrainerSecretId(this.#handle),
      },
      gender: this.#api.GameTrainerGender(
        this.#handle
      ) as TrainerInfo['gender'],
      money: this.#api.GameMoney(this.#handle),
    }
  }

  get boxCount(): number {
    return this.#api.GameBoxCount(this.#handle)
  }

  box(index: number): Pokemon[] {
    if (!Number.isInteger(index) || index < 0 || index >= this.boxCount) {
      throw new RangeError(`box index ${index} outside [0, ${this.boxCount})`)
    }
    const handles = this.#api.GameBoxMonHandles(this.#handle, index)
    return Array.from(handles, (id) => new PokemonHandle(id, this.#api))
  }

  party(): Pokemon[] {
    const handles = this.#api.GamePartyMonHandles(this.#handle)
    return Array.from(handles, (id) => new PokemonHandle(id, this.#api))
  }

  get generation(): string {
    return this.#api.GameGeneration(this.#handle)
  }

  get saveVersion(): string {
    return this.#api.GameSaveVersion(this.#handle)
  }

  get isVersionAggregated(): boolean {
    return this.#api.GameVersionIsAggregated(this.#handle)
  }

  boxName(index: number): string {
    this.#requireBox(index)
    return this.#api.GameBoxName(this.#handle, index)
  }

  /** Positional box: the wasm side sends 0 for an empty slot; that becomes null here, once. */
  boxSlots(index: number): (Pokemon | null)[] {
    this.#requireBox(index)
    return Array.from(this.#api.GameBoxSlotHandles(this.#handle, index), (id) =>
      this.#slot(id)
    )
  }

  /** Positional party: six entries, null where empty. */
  partySlots(): (Pokemon | null)[] {
    return Array.from(this.#api.GamePartySlotHandles(this.#handle), (id) =>
      this.#slot(id)
    )
  }

  setBoxSlot(boxIndex: number, slot: number, pokemon: Pokemon | null): void {
    this.#requireBox(boxIndex)
    if (!Number.isInteger(slot) || slot < 0)
      throw new RangeError(`box slot ${slot} is out of range`)
    this.#api.GameSetBoxSlot(
      this.#handle,
      boxIndex,
      slot,
      pokemon === null ? 0 : PokemonHandle.handleOf(pokemon)
    )
  }

  /** Idempotent: the wasm registry ignores an already-released handle. */
  dispose(): void {
    this.#api.Close(this.#handle)
  }

  #slot(id: number): Pokemon | null {
    return id === 0 ? null : new PokemonHandle(id, this.#api)
  }

  #requireBox(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.boxCount) {
      throw new RangeError(`box index ${index} outside [0, ${this.boxCount})`)
    }
  }

  /** Per-game item table, version-scoped by this save's generation context. */
  get items(): LookupTable<ItemInfo> {
    return itemsForGeneration(this.generation)
  }
}
