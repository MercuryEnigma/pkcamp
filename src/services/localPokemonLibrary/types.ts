import type { Generation } from '../saveLibrary'

/** One standalone `.pk*` file stored in a generation's local collection. */
export interface StoredPokemonFile {
  id: string
  /** Zero-based position in the generation's fixed local storage grid. */
  slot: number
  fileName: string
  bytes: Uint8Array
  importedAt: string
}

/**
 * Browser-local storage for standalone Pokémon files.
 *
 * The caller chooses the generation and validates the file with the Pokémon
 * adapter before calling `add`. This service deliberately stores opaque bytes
 * and does not duplicate PKHeX parsing or format detection.
 */
export interface LocalPokemonLibrary {
  /** Positional records, with explicit nulls for empty positions. */
  getSlots(generation: Generation): Promise<(StoredPokemonFile | null)[]>
  /** Atomically replace a collection sized in complete 30-slot boxes. */
  saveSlots(
    generation: Generation,
    slots: readonly (StoredPokemonFile | null)[]
  ): Promise<void>
  list(generation: Generation): Promise<StoredPokemonFile[]>
  get(generation: Generation, id: string): Promise<StoredPokemonFile | null>
  add(
    generation: Generation,
    file: { fileName: string; bytes: Uint8Array }
  ): Promise<StoredPokemonFile>
  discard(generation: Generation, id: string): Promise<void>
}
