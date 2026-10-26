import { describe, expect, it } from 'vitest'
import {
  createMockPokemonSaveBackend,
  encodePokemonFileBytes,
  initializePokemonSaveAdapter,
} from '../../../services/pkhex'
import {
  CAMP_SITE_SIZE,
  type Camp,
  type CampPokemon,
} from '../../../services/storage'
import { campFingerprint, scanCamp } from './scanCamp'
import { makeNode } from './testHelpers'

const adapter = initializePokemonSaveAdapter({
  backend: createMockPokemonSaveBackend(),
})

function campPokemon(id: string, bytes: Uint8Array): CampPokemon {
  return { id, fileName: `${id}.pk3`, bytes, importedAt: '2026-10-01' }
}

function camp(...placed: [site: number, index: number, CampPokemon][]): Camp {
  const sites = [0, 1].map(() =>
    new Array<CampPokemon | null>(CAMP_SITE_SIZE).fill(null)
  )
  for (const [site, index, pokemon] of placed) sites[site][index] = pokemon
  return { sites }
}

const pikachu = campPokemon(
  'p1',
  encodePokemonFileBytes(makeNode({ species: 25 }))
)
const mew = campPokemon(
  'm1',
  encodePokemonFileBytes(makeNode({ species: 151 }))
)

describe('scanCamp', () => {
  it('reads each Camp Pokémon with its Camp Site position', () => {
    const { pokemon, status } = scanCamp(
      adapter,
      camp([0, 3, pikachu], [1, 0, mew])
    )
    expect(pokemon.map((p) => [p.node.species, p.source])).toEqual([
      [25, { camp: true, location: { site: 0, index: 3 } }],
      [151, { camp: true, location: { site: 1, index: 0 } }],
    ])
    expect(status).toMatchObject({ state: 'ok', count: 2, unreadable: 0 })
  })

  it('counts and skips files the adapter cannot read', () => {
    const broken = campPokemon('x', new TextEncoder().encode('not a pk3'))
    const { pokemon, status } = scanCamp(
      adapter,
      camp([0, 0, broken], [0, 1, pikachu])
    )
    expect(pokemon).toHaveLength(1)
    expect(status).toMatchObject({ state: 'ok', count: 1, unreadable: 1 })
  })
})

describe('campFingerprint', () => {
  it('changes when a Pokémon is added, removed, or moved', () => {
    const base = campFingerprint(camp([0, 3, pikachu]))
    expect(campFingerprint(camp([0, 3, pikachu]))).toBe(base)
    expect(campFingerprint(camp([0, 4, pikachu]))).not.toBe(base)
    expect(campFingerprint(camp([0, 3, pikachu], [1, 0, mew]))).not.toBe(base)
    expect(campFingerprint(camp())).not.toBe(base)
  })

  it('starts with the stored Camp Pokémon count', () => {
    expect(campFingerprint(camp())).toMatch(/^0:/)
    expect(campFingerprint(camp([0, 3, pikachu], [1, 0, mew]))).toMatch(/^2:/)
  })
})
