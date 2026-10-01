import {
  POKEAPI_SOURCE,
  PMDCOLLAB_SOURCE,
  POKEMONDB_SOURCE,
  SHUFFLE_SOURCE,
  type SpriteSourceDefinition,
} from '../../services/sprites'

/**
 * Selectable sprite sources for Poké Storage's sprite-resource setting. This
 * is the parameterization hook the sprite boundary review called for ("a
 * future Options screen can let the player pick a different asset source")
 * — the actual Options UI is this file's consumer, but every source's
 * manifest, coverage report, and homepage live in `src/services/sprites`
 * itself now that all four are equally generated and live-verified.
 */
export const SPRITE_SOURCES: ReadonlyArray<SpriteSourceDefinition> = [
  POKEAPI_SOURCE,
  SHUFFLE_SOURCE,
  POKEMONDB_SOURCE,
  PMDCOLLAB_SOURCE,
]

export const DEFAULT_SPRITE_SOURCE_ID = POKEAPI_SOURCE.id
