import { describe, expect, it } from 'vitest'
import {
  CAMPING_POKEMON_BOX_SIZE,
  minimumCampingBoxCount,
  resizeCampingSlots,
} from './campingStoragePreference'

describe('Camping Pokémon box sizing', () => {
  it('defaults to one box and rounds occupied counts up by 30', () => {
    expect(minimumCampingBoxCount(0)).toBe(1)
    expect(minimumCampingBoxCount(30)).toBe(1)
    expect(minimumCampingBoxCount(31)).toBe(2)
    expect(minimumCampingBoxCount(61)).toBe(3)
  })

  it('expands storage in complete 30-slot boxes', () => {
    const slots = resizeCampingSlots(['Bulbasaur'], 2)

    expect(slots).toHaveLength(CAMPING_POKEMON_BOX_SIZE * 2)
    expect(slots[0]).toBe('Bulbasaur')
  })

  it('moves overflow into earlier empty positions when shrinking', () => {
    const original = new Array<string | null>(60).fill(null)
    original[0] = 'Bulbasaur'
    original[45] = 'Pikachu'

    const slots = resizeCampingSlots(original, 1)

    expect(slots).toHaveLength(CAMPING_POKEMON_BOX_SIZE)
    expect(slots[0]).toBe('Bulbasaur')
    expect(slots[1]).toBe('Pikachu')
  })

  it('will not shrink below the number of boxes needed by the contents', () => {
    const original = Array.from(
      { length: 31 },
      (_, index) => `pokemon-${index}`
    )

    expect(resizeCampingSlots(original, 1)).toHaveLength(60)
  })
})
