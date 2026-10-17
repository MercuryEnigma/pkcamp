import {
  POKEAPI_SOURCE,
  PMDCOLLAB_SOURCE,
  POKEMONDB_SOURCE,
  SHUFFLE_SOURCE,
  type SpriteSourceDefinition,
} from './index'

export const SPRITE_SOURCES: ReadonlyArray<SpriteSourceDefinition> = [
  POKEAPI_SOURCE,
  SHUFFLE_SOURCE,
  POKEMONDB_SOURCE,
  PMDCOLLAB_SOURCE,
]

export const DEFAULT_SPRITE_SOURCE_ID = POKEAPI_SOURCE.id
