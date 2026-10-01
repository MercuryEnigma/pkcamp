/**
 * Public adapter boundary for reading Pokemon save files.
 *
 * FOLLOW-UP: there is no real backend yet. The long-term plan is to fork
 * PKHeX.Core / PKHeX.Facade (see
 * https://github.com/arleypadua/PKHeX.Everywhere/tree/main/src/PKHeX.Facade)
 * and compile it to WASM via .NET tooling, then implement
 * `PokemonSaveBackend` (backend.ts) against it. That is out of scope here.
 * This module defines the contract such a backend must satisfy, plus the
 * normalized-type public API (types.ts) that the rest of the app should code
 * against — nothing in this file's public surface should need to change when
 * the real backend lands, only the `backend` passed into
 * `initializePokemonSaveAdapter`.
 */

import type { PokemonSaveBackend } from './backend.ts'
import type {
  BoxLocation,
  BoxNode,
  PartyNode,
  PokemonMove,
  PokemonNode,
  SaveGame,
  SaveSlot,
} from './types.ts'

export interface PokemonSaveAdapterOptions {
  backend: PokemonSaveBackend
}

export interface PokemonSaveAdapter {
  /** Load a save file's raw bytes into a normalized {@link SaveGame}. */
  load(bytes: Uint8Array): SaveGame
  /** Import a single `.pkm` file's raw bytes as a {@link PokemonNode}. */
  importPokemonFile(bytes: Uint8Array): PokemonNode
  /** Export a {@link PokemonNode} back to `.pkm` file bytes. */
  exportPokemonFile(pokemon: PokemonNode): Uint8Array
  /**
   * Place an imported (or otherwise held) Pokemon node into a party slot,
   * returning a new party array (slots are not mutated in place).
   */
  placeInParty(
    party: PartyNode,
    slotIndex: number,
    pokemon: PokemonNode | null
  ): PartyNode
  /**
   * Place an imported (or otherwise held) Pokemon node into a box slot,
   * returning a new box (the box is not mutated in place).
   */
  placeInBox(
    box: BoxNode,
    slotIndex: number,
    pokemon: PokemonNode | null
  ): BoxNode
}

function assertValidIndex(
  slots: unknown[],
  index: number,
  label: string
): void {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length) {
    throw new RangeError(
      `${label} index ${index} is out of bounds (0..${slots.length - 1})`
    )
  }
}

function locationKey(location: BoxLocation): string {
  return `${location.box}:${location.slot}`
}

/**
 * Build the adapter over an injectable low-level `backend`. This is the seam
 * a future forked-WASM implementation slots into — everything above this
 * function is backend-agnostic.
 */
export function initializePokemonSaveAdapter(
  options: PokemonSaveAdapterOptions
): PokemonSaveAdapter {
  const { backend } = options

  return {
    load(bytes: Uint8Array): SaveGame {
      const data = backend.loadSave(bytes)
      let disposed = false

      const requireOpen = (): void => {
        if (disposed) throw new Error('Cannot use a disposed save')
      }
      const slotAt = (location: BoxLocation): SaveSlot => {
        assertValidIndex(data.boxes, location.box, 'Box')
        const box = data.boxes[location.box]
        assertValidIndex(box.slots, location.slot, 'Box slot')
        return box.slots[location.slot]
      }
      const writeSlot = (location: BoxLocation, pokemon: SaveSlot): void => {
        backend.setBoxSlot(data, location, pokemon)
        data.boxes[location.box].slots[location.slot] = pokemon
      }

      return {
        trainer: data.trainer,
        party: data.party,
        boxes: data.boxes,
        version: data.version,
        movePokemon(from: BoxLocation, to: BoxLocation): void {
          requireOpen()
          const source = slotAt(from)
          const destination = slotAt(to)
          if (locationKey(from) === locationKey(to)) return
          if (source === null) throw new Error('Cannot move an empty box slot')

          writeSlot(to, source)
          writeSlot(from, destination)
        },
        movePokemonGroup(moves: readonly PokemonMove[]): void {
          requireOpen()
          if (moves.length === 0)
            throw new Error('A group move must contain at least one slot')

          const sourceKeys = new Set<string>()
          const destinationKeys = new Set<string>()
          const snapshot = moves.map(({ from, to }) => {
            const fromKey = locationKey(from)
            const toKey = locationKey(to)
            if (sourceKeys.has(fromKey))
              throw new Error(`Duplicate group-move source ${fromKey}`)
            if (destinationKeys.has(toKey))
              throw new Error(`Duplicate group-move destination ${toKey}`)
            sourceKeys.add(fromKey)
            destinationKeys.add(toKey)
            return { from, to, pokemon: slotAt(from), destination: slotAt(to) }
          })

          if (!snapshot.some(({ pokemon }) => pokemon !== null)) {
            throw new Error('Cannot move a group containing only empty slots')
          }
          for (const { to, destination } of snapshot) {
            if (destination !== null && !sourceKeys.has(locationKey(to))) {
              throw new Error(
                'Group move destination overlaps a Pokémon outside the selected group'
              )
            }
          }

          // Clear first so overlapping source/destination rectangles retain
          // their snapshot layout instead of reading partially-written state.
          for (const { from } of snapshot) writeSlot(from, null)
          for (const { to, pokemon } of snapshot) writeSlot(to, pokemon)
        },
        setBoxSlot(location: BoxLocation, pokemon: PokemonNode | null): void {
          requireOpen()
          slotAt(location)
          writeSlot(location, pokemon)
        },
        toBytes(): Uint8Array {
          requireOpen()
          return backend.saveBytes(data)
        },
        dispose(): void {
          // Idempotent by design: a WASM backend's retained state must only
          // be released once, but callers (React effect cleanup, error
          // paths, etc.) may reasonably call dispose() more than once.
          if (disposed) return
          disposed = true
          backend.releaseSave?.(data)
        },
      }
    },

    importPokemonFile(bytes: Uint8Array): PokemonNode {
      return backend.loadPokemonFile(bytes)
    },

    exportPokemonFile(pokemon: PokemonNode): Uint8Array {
      return backend.exportPokemonFile(pokemon)
    },

    placeInParty(
      party: PartyNode,
      slotIndex: number,
      pokemon: PokemonNode | null
    ): PartyNode {
      assertValidIndex(party, slotIndex, 'Party slot')
      const next = party.slice()
      next[slotIndex] = pokemon
      return next
    },

    placeInBox(
      box: BoxNode,
      slotIndex: number,
      pokemon: PokemonNode | null
    ): BoxNode {
      assertValidIndex(box.slots, slotIndex, 'Box slot')
      const slots = box.slots.slice()
      slots[slotIndex] = pokemon
      return { name: box.name, slots }
    },
  }
}
