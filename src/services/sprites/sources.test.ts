import { describe, expect, it } from 'vitest'
import { initializeSpriteResolver } from './resolver'
import { POKEAPI_SOURCE, SHUFFLE_SOURCE } from './sources'
import { POKEMONDB_SOURCE } from './pokemonDbSource'
import { PMDCOLLAB_SOURCE } from './pmdCollabSource'

const ALL_SOURCES = [
  POKEAPI_SOURCE,
  SHUFFLE_SOURCE,
  POKEMONDB_SOURCE,
  PMDCOLLAB_SOURCE,
]

it.each(ALL_SOURCES.map((source) => [source.id, source] as const))(
  '%s has a base icon for every National Dex species through 1025',
  (_, source) => {
    expect(source.coverage.base.available).toHaveLength(1025)
    expect(source.coverage.base.missing).toEqual([])
  }
)

describe('PokeAPI source resolution', () => {
  const resolver = initializeSpriteResolver({
    sourceId: POKEAPI_SOURCE.id,
    manifest: POKEAPI_SOURCE.manifest,
    formAliases: POKEAPI_SOURCE.formAliases,
  })

  it('resolves shiny female art', () => {
    expect(
      resolver.resolvePokemonSprite({
        nationalDex: 3,
        displayName: 'Venusaur',
        gender: 'female',
        shiny: true,
      })
    ).toMatchObject({
      assetPath: expect.stringMatching(/\/shiny\/female\/3\.png$/),
    })
  })

  it('resolves a numeric save-form index through the shared form-alias table', () => {
    expect(
      resolver.resolvePokemonSprite({
        nationalDex: 386,
        displayName: 'Deoxys',
        formId: 1,
      })
    ).toMatchObject({ assetPath: expect.stringMatching(/\/10001\.png$/) })
  })
})

describe('Shuffle source resolution', () => {
  const resolver = initializeSpriteResolver({
    sourceId: SHUFFLE_SOURCE.id,
    manifest: SHUFFLE_SOURCE.manifest,
    formAliases: SHUFFLE_SOURCE.formAliases,
  })

  it('resolves a named form from Ribbon Helper form_icons', () => {
    expect(
      resolver.resolvePokemonSprite({
        nationalDex: 386,
        displayName: 'Deoxys',
        formId: 'deoxys-attack',
      })
    ).toMatchObject({ assetPath: expect.stringMatching(/\/386_f34\.png$/) })
  })
})

describe('pokemondb source resolution', () => {
  const resolver = initializeSpriteResolver({
    sourceId: POKEMONDB_SOURCE.id,
    manifest: POKEMONDB_SOURCE.manifest,
    formAliases: POKEMONDB_SOURCE.formAliases,
  })

  it("resolves a form whose pokemondb slug differs from PokeAPI's canonical id", () => {
    expect(
      resolver.resolvePokemonSprite({
        nationalDex: 931,
        displayName: 'Squawkabilly',
        formId: 'squawkabilly-yellow-plumage',
      })
    ).toMatchObject({
      assetPath: expect.stringMatching(/\/squawkabilly-yellow\.png$/),
    })
  })
})

describe('pmdcollab source resolution', () => {
  const resolver = initializeSpriteResolver({
    sourceId: PMDCOLLAB_SOURCE.id,
    manifest: PMDCOLLAB_SOURCE.manifest,
    formAliases: PMDCOLLAB_SOURCE.formAliases,
  })

  it('resolves a named form portrait', () => {
    expect(
      resolver.resolvePokemonSprite({
        nationalDex: 931,
        displayName: 'Squawkabilly',
        formId: 'squawkabilly-yellow-plumage',
      })
    ).toMatchObject({
      assetPath: expect.stringMatching(/portrait\/0931\/0002\/Normal\.png$/),
    })
  })

  it('resolves a shiny female variant nested under a named form', () => {
    expect(
      resolver.resolvePokemonSprite({
        nationalDex: 215,
        displayName: 'Sneasel',
        formId: 'sneasel-hisui',
        gender: 'female',
        shiny: true,
      })
    ).toMatchObject({
      assetPath: expect.stringMatching(
        /portrait\/0215\/0001\/0001\/0002\/Normal\.png$/
      ),
    })
  })
})
