import { describe, expect, it } from 'vitest'
import { spriteAttribution } from './attribution'
import { initializeSpriteResolver } from './resolver'
import { resolveSpriteDisplay } from '../../pages/pokestorage/spriteDisplay'
import { POKEMONDB_SOURCE } from './pokemonDbSource'

describe('featured image credits', () => {
  it('links to the exact repository file for a shiny variant', () => {
    expect(
      spriteAttribution(
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/24.png'
      )
    ).toEqual({
      name: 'PokeAPI/sprites',
      sourceUrl:
        'https://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/shiny/24.png',
    })
  })
  it('uses named portrait contributors instead of the repository name', () => {
    const credit = spriteAttribution(
      'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/portrait/0024/Normal.png'
    )
    expect(credit?.name).toBeTruthy()
    expect(credit?.name).not.toBe('PMDCollab/SpriteCollab')
    expect(credit?.sourceUrl).toContain('/blob/master/portrait/0024/Normal.png')
  })
  it('credits substituted base art and the actual unknown placeholder', () => {
    const resolver = initializeSpriteResolver({
      sourceId: 'test',
      manifest: [
        {
          nationalDex: 24,
          egg: false,
          shiny: false,
          assetPath:
            'https://raw.githubusercontent.com/nileplumb/PkmnShuffleMap/master/UICONS/pokemon/24.png',
        },
      ],
    })
    const base = resolveSpriteDisplay(resolver, {
      nationalDex: 24,
      displayName: 'Arbok',
      shiny: true,
    })
    expect(base.kind).toBe('approximate')
    expect(base.attribution?.name).toBe('PkmnShuffleMap')
    const unknown = resolveSpriteDisplay(resolver, {
      nationalDex: 25,
      displayName: 'Pikachu',
    })
    expect(unknown.attribution?.sourceUrl).toContain('/sprites/pokemon/egg.png')
  })
  it('links Pokémon Database forms to the species artwork page', () => {
    const resolver = initializeSpriteResolver({
      sourceId: POKEMONDB_SOURCE.id,
      manifest: POKEMONDB_SOURCE.manifest,
      formAliases: POKEMONDB_SOURCE.formAliases,
    })
    const result = resolver.resolvePokemonSprite({
      nationalDex: 386,
      displayName: 'Deoxys',
      formId: 'deoxys-attack',
    })
    expect(result.status).toBe('available')
    if (result.status === 'available')
      expect(result.attribution?.sourceUrl).toBe(
        'https://pokemondb.net/sprites/deoxys'
      )
  })
})
