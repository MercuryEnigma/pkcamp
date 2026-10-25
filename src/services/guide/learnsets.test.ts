import { describe, expect, it } from 'vitest'
import { hasMoveTutors, readTutorMoves } from './learnsets'

const move = (id: number) => ({
  romId: id,
  nationalMoveId: id,
  romName: `MOVE ${id}`,
})

describe('tutor moves', () => {
  it('reads Emerald’s 30-move list with four-byte species rows', () => {
    const rom = new Uint8Array(0x4000)
    for (let slot = 0; slot < 30; slot++) rom[0x100 + slot * 2] = slot + 1
    // Species 1 learns slots 0 and 29.
    rom[0x200 + 4] = 0b1
    rom[0x200 + 4 + 3] = 0b100000
    const table = readTutorMoves(rom, 0x100, 0x200, 'emerald', move)
    expect(table.status).toBe('available')
    expect(table.moves.get(1)?.map(({ romId }) => romId)).toEqual([1, 30])
    expect(table.moves.get(2)).toEqual([])
  })

  it('reads FireRed’s 15-move list with two-byte species rows', () => {
    const rom = new Uint8Array(0x4000)
    for (let slot = 0; slot < 15; slot++) rom[0x100 + slot * 2] = slot + 1
    rom[0x200 + 2 + 1] = 0b1000000
    const table = readTutorMoves(rom, 0x100, 0x200, 'firered', move)
    expect(table.moves.get(1)?.map(({ romId }) => romId)).toEqual([15])
  })

  it('marks empty list slots partial and Ruby as having no tutors', () => {
    const rom = new Uint8Array(0x4000)
    rom[0x100] = 1
    expect(readTutorMoves(rom, 0x100, 0x200, 'firered', move).status).toBe(
      'partial'
    )
    expect(readTutorMoves(rom, 0x100, 0x200, 'ruby', move).status).toBe(
      'unavailable'
    )
    expect(hasMoveTutors('ruby')).toBe(false)
    expect(hasMoveTutors('leafgreen')).toBe(true)
  })
})
