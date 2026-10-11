import type { PokemonNode } from '../../../services/pkhex'
import type { ScannedPokemon } from './collectionTypes'

const ZERO = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
}

/** A plain level 10 Bulbasaur-like node with any field overridden. */
export function makeNode(overrides: Partial<PokemonNode> = {}): PokemonNode {
  return {
    species: 1,
    form: 0,
    level: 10,
    gender: 'Male',
    shiny: false,
    isEgg: false,
    nickname: 'MON',
    originalTrainerName: 'RED',
    originalTrainerId: 1,
    heldItem: 0,
    heldItemName: '',
    nature: { id: 0, name: 'Hardy' },
    ability: { id: 65, name: 'Overgrow' },
    moves: [{ id: 33, name: 'Tackle', pp: 35 }, null, null, null],
    ribbons: [],
    ivs: ZERO,
    evs: ZERO,
    stats: ZERO,
    ...overrides,
  }
}

export function scanned(
  overrides: Partial<PokemonNode> = {},
  source: ScannedPokemon['source'] = { gameId: 'emerald', location: 'party' }
): ScannedPokemon {
  return { node: makeNode(overrides), source }
}
