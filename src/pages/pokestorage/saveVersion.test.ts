import { describe, expect, it } from 'vitest'
import type { SaveGame } from '../../services/pkhex'
import { assertSaveMatchesCabin, gameIdsFromSave } from './saveVersion'

function save(exact: SaveGame['version']['exact']): Pick<SaveGame, 'version'> {
  return {
    version: {
      exact,
      approximateGeneration: 3,
      aggregated: exact === 'Unknown' ? 'Gen 3 (approximate)' : exact,
    },
  }
}

describe('assertSaveMatchesCabin', () => {
  it('accepts the selected Cabin game', () => {
    expect(() =>
      assertSaveMatchesCabin('emerald', save('Emerald'))
    ).not.toThrow()
  })

  it('accepts a Ruby/Sapphire save in either of those Cabins only', () => {
    expect(() =>
      assertSaveMatchesCabin('ruby', save('RubySapphire'))
    ).not.toThrow()
    expect(() =>
      assertSaveMatchesCabin('sapphire', save('RubySapphire'))
    ).not.toThrow()
    expect(() =>
      assertSaveMatchesCabin('emerald', save('RubySapphire'))
    ).toThrow('not a Emerald save')
  })

  it('rejects a different or unknown game', () => {
    expect(() => assertSaveMatchesCabin('ruby', save('Sapphire'))).toThrow(
      'not a Ruby save'
    )
    expect(() => assertSaveMatchesCabin('ruby', save('Unknown'))).toThrow(
      'not a Ruby save'
    )
  })
})

describe('gameIdsFromSave', () => {
  it('names one game, both Ruby and Sapphire, or none', () => {
    expect(gameIdsFromSave(save('Emerald'))).toEqual(['emerald'])
    expect(gameIdsFromSave(save('RubySapphire'))).toEqual(['ruby', 'sapphire'])
    expect(gameIdsFromSave(save('Unknown'))).toEqual([])
  })
})
