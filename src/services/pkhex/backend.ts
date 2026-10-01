/**
 * The low-level "backend" seam. This is the interface a future, real backend
 * (a forked PKHeX.Core / PKHeX.Facade compiled to WASM via .NET tooling) must
 * satisfy. It is intentionally shaped close to the Facade's own API surface
 * (`Game.LoadFrom`, `Pokemon.LoadFrom`/`ToFile`) rather than the old flat
 * `pkhex-wasm` `{view, serialize, dispose}` design, so swapping in a real
 * implementation later should not require changing the adapter's public API
 * (see `adapter.ts`).
 */

import type {
  BoxLocation,
  BoxNode,
  GameVersionIdentity,
  PartyNode,
  PokemonNode,
  TrainerNode,
} from './types.ts'

/** Everything the backend was able to read out of a save file, un-wrapped. */
export interface BackendSaveData {
  trainer: TrainerNode
  party: PartyNode
  boxes: BoxNode[]
  version: GameVersionIdentity
}

/**
 * Low-level operations a backend must implement. All methods are synchronous
 * here because the mock backend is; a real WASM backend may need to expose an
 * async variant (e.g. `loadSaveAsync`) — that can be layered on this seam
 * without breaking the adapter's public API, which is written against this
 * interface.
 */
export interface PokemonSaveBackend {
  /** Parse a save file's raw bytes into normalized data. */
  loadSave(bytes: Uint8Array): BackendSaveData
  /** Parse a single `.pkm` file's raw bytes into a normalized Pokemon node. */
  loadPokemonFile(bytes: Uint8Array): PokemonNode
  /** Serialize a Pokemon node back into `.pkm` file bytes. */
  exportPokemonFile(pokemon: PokemonNode): Uint8Array
  /** Write one whole Pokemon into a box slot, or clear it with `null`. */
  setBoxSlot(
    data: BackendSaveData,
    location: BoxLocation,
    pokemon: PokemonNode | null
  ): void
  /** Commit and serialize the backend's current state for this save. */
  saveBytes(data: BackendSaveData): Uint8Array
  /**
   * Optional hook for releasing any backend-side resources associated with a
   * previously loaded save (e.g. native/WASM memory). Safe to omit for
   * backends with nothing to release.
   */
  releaseSave?(data: BackendSaveData): void
}
