/**
 * Public entry point for the PKHeX adapter boundary. Consumers should import
 * from here rather than reaching into individual files.
 */

export { initializePokemonSaveAdapter } from './adapter.ts'
export type {
  PokemonSaveAdapter,
  PokemonSaveAdapterOptions,
} from './adapter.ts'
export type { BackendSaveData, PokemonSaveBackend } from './backend.ts'
export {
  createMockPokemonSaveBackend,
  encodeFixtureSaveBytes,
  encodePokemonFileBytes,
} from './mockBackend.ts'
export {
  createPkhexWasmBackend,
  defaultWasmBaseUrl,
} from './pkhexWasmBackend.ts'
export type { PkhexWasmBackendOptions } from './pkhexWasmBackend.ts'
export type {
  BoxLocation,
  BoxNode,
  GameGeneration,
  GameVersion,
  GameVersionIdentity,
  Gender,
  MoveNode,
  NamedRef,
  PartyNode,
  PokemonMove,
  PokemonNode,
  RibbonRef,
  SaveGame,
  SaveSlot,
  StatSpread,
  TrainerNode,
} from './types.ts'
