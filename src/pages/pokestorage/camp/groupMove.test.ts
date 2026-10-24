import { describe, expect, it } from 'vitest'
import { groupCells, planGroupMove } from './groupMove'

describe('groupCells', () => {
  it('covers the rectangle between two corners in either order', () => {
    expect(groupCells(0, 7)).toEqual([0, 1, 6, 7])
    expect(groupCells(7, 0)).toEqual([0, 1, 6, 7])
  })
  it('is one cell when the corners match', () => {
    expect(groupCells(8, 8)).toEqual([8])
  })
})

describe('planGroupMove', () => {
  it('keeps the group shape from the destination top-left', () => {
    const plan = planGroupMove([0, 1, 6, 7], 14)
    expect(plan).toEqual({
      pairs: [
        { from: 0, to: 14 },
        { from: 1, to: 15 },
        { from: 6, to: 20 },
        { from: 7, to: 21 },
      ],
    })
  })
  it('rejects a group that would run off the right edge', () => {
    expect(planGroupMove([0, 1], 5)).toEqual({
      error: 'That group would extend beyond the destination.',
    })
  })
  it('rejects a group that would run off the bottom', () => {
    expect(planGroupMove([0, 6], 24)).toEqual({
      error: 'That group would extend beyond the destination.',
    })
  })
})
