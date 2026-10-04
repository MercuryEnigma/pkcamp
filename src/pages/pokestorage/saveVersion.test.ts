import { describe, expect, it } from 'vitest'
import type { SaveGame } from '../../services/pkhex'
import { assertSaveMatchesCabin } from './saveVersion'

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
    expect(() => assertSaveMatchesCabin('emerald', save('Emerald'))).not.toThrow()
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
