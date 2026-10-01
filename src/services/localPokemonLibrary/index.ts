export type { LocalPokemonLibrary, StoredPokemonFile } from './types'
export { IndexedDbLocalPokemonLibrary } from './indexedDb'
export { LOCAL_POKEMON_SLOT_COUNT } from './indexedDb'

import { IndexedDbLocalPokemonLibrary } from './indexedDb'
import type { LocalPokemonLibrary } from './types'

/** Shared browser-local collection used by the Poké Storage UI. */
export const localPokemonLibrary: LocalPokemonLibrary =
  new IndexedDbLocalPokemonLibrary()
