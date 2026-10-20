import { describe, expect, it } from 'vitest'
import { gen3GameIdFromCode } from './gen3GameCode'

describe('gen3GameIdFromCode', () => {
  it('maps cartridge codes to Gen 3 games', () => {
    expect(gen3GameIdFromCode('BPEE')).toBe('emerald')
    expect(gen3GameIdFromCode('AXPJ')).toBe('sapphire')
    expect(gen3GameIdFromCode('AGBJ')).toBeNull()
  })
})
