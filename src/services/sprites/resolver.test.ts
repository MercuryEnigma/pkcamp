import { describe, expect, it } from 'vitest'
import { initializeSpriteResolver } from './resolver'
import type { SpriteManifestEntry } from './manifest'

const fixtureManifest: SpriteManifestEntry[] = [
  {
    nationalDex: 1,
    shiny: false,
    egg: false,
    assetPath: 'sprites/fixture/front/001.png',
  },
  {
    nationalDex: 1,
    gender: 'female',
    shiny: false,
    egg: false,
    assetPath: 'sprites/fixture/front/001-female.png',
  },
  {
    nationalDex: 1,
    egg: true,
    shiny: false,
    assetPath: 'sprites/fixture/front/001-egg.png',
  },
  {
    nationalDex: 4,
    form: 'spiky-eared',
    shiny: false,
    egg: false,
    assetPath: 'sprites/fixture/front/004-spiky-eared.png',
  },
]

describe('resolvePokemonSprite (via initializeSpriteResolver)', () => {
  const resolver = initializeSpriteResolver({
    sourceId: 'fixture-source',
    manifest: fixtureManifest,
  })

  it('returns an available result with the exact asset path for a verified base-form match', () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 1,
      displayName: 'Bulbasaur',
    })
    expect(result).toEqual({
      status: 'available',
      assetPath: 'sprites/fixture/front/001.png',
      label: 'Bulbasaur',
    })
  })

  it("falls back honestly with a species-appropriate reason when the species isn't in the manifest at all", () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 2,
      displayName: 'Ivysaur',
    })
    expect(result.status).toBe('fallback')
    expect(result).toMatchObject({ reason: 'missing-species' })
  })

  it('prefers a requested gender variant over generic art', () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 1,
      displayName: 'Bulbasaur',
      gender: 'female',
    })
    expect(result).toMatchObject({
      status: 'available',
      assetPath: 'sprites/fixture/front/001-female.png',
    })
  })

  it('uses source-independent aliases for numeric save form indexes', () => {
    const aliased = initializeSpriteResolver({
      sourceId: 'aliased',
      manifest: fixtureManifest,
      formAliases: { 4: { 1: 'spiky-eared' } },
    })
    expect(
      aliased.resolvePokemonSprite({
        nationalDex: 4,
        displayName: 'Charmander',
        formId: 1,
      })
    ).toMatchObject({
      status: 'available',
      assetPath: 'sprites/fixture/front/004-spiky-eared.png',
    })
  })

  it('falls back honestly when an unverified form is requested rather than substituting the base sprite', () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 4,
      displayName: 'Charmander',
      formId: 'some-other-form',
    })
    expect(result.status).toBe('fallback')
    expect(result).toMatchObject({ reason: 'missing-form' })
  })

  it('falls back honestly for a shiny request with no matching shiny entry, instead of silently returning the base sprite', () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 1,
      displayName: 'Bulbasaur',
      shiny: true,
    })
    expect(result.status).toBe('fallback')
    expect(result).toMatchObject({ reason: 'shiny-unavailable' })
  })

  it('falls back honestly for an egg request with no matching egg entry', () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 4,
      displayName: 'Charmander',
      egg: true,
    })
    expect(result.status).toBe('fallback')
    expect(result).toMatchObject({ reason: 'egg-unavailable' })
  })

  it('resolves an egg request when a matching egg entry exists', () => {
    const result = resolver.resolvePokemonSprite({
      nationalDex: 1,
      displayName: 'Bulbasaur',
      egg: true,
    })
    expect(result).toEqual({
      status: 'available',
      assetPath: 'sprites/fixture/front/001-egg.png',
      label: 'Bulbasaur Egg',
    })
  })

  it('produces independent resolvers for two different sourceId/manifest configs', () => {
    const resolverA = initializeSpriteResolver({
      sourceId: 'source-a',
      manifest: [
        {
          nationalDex: 7,
          shiny: false,
          egg: false,
          assetPath: 'sprites/source-a/front/007.png',
        },
      ],
    })
    const resolverB = initializeSpriteResolver({
      sourceId: 'source-b',
      manifest: [
        {
          nationalDex: 7,
          shiny: false,
          egg: false,
          assetPath: 'sprites/source-b/front/007.png',
        },
      ],
    })

    expect(resolverA.sourceId).toBe('source-a')
    expect(resolverB.sourceId).toBe('source-b')

    const resultA = resolverA.resolvePokemonSprite({
      nationalDex: 7,
      displayName: 'Squirtle',
    })
    const resultB = resolverB.resolvePokemonSprite({
      nationalDex: 7,
      displayName: 'Squirtle',
    })

    expect(resultA).toMatchObject({
      assetPath: 'sprites/source-a/front/007.png',
    })
    expect(resultB).toMatchObject({
      assetPath: 'sprites/source-b/front/007.png',
    })

    // Each resolver only knows about its own manifest.
    const missingInA = resolverA.resolvePokemonSprite({
      nationalDex: 1,
      displayName: 'Bulbasaur',
    })
    expect(missingInA).toMatchObject({ reason: 'missing-species' })
  })
})
