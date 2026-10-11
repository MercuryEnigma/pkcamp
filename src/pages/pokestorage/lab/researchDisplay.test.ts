import { describe, expect, it } from 'vitest'
import type { CollectionScanState } from './useCollectionScan'
import { researchAvailability, researchSummary } from './researchDisplay'

function scan(
  overrides: Partial<CollectionScanState> = {}
): CollectionScanState {
  return {
    result: null,
    phase: 'idle',
    saves: {},
    targets: [],
    cabins: [],
    failedCabins: [],
    unsaved: false,
    storageError: null,
    offline: false,
    waitingForPkHex: false,
    rebuild() {},
    resetHistory() {},
    ...overrides,
  }
}
const result = { owned: 3 } as NonNullable<CollectionScanState['result']>
describe('research dashboard availability', () => {
  it('does not keep loading after an offline or failed scan with no stored results', () => {
    for (const unavailable of [
      scan({ offline: true }),
      scan({ storageError: 'Could not read storage' }),
      scan({ waitingForPkHex: true }),
    ]) {
      expect(researchAvailability(unavailable)).toBe('unavailable')
      expect(researchSummary([unavailable]).availability).toBe('unavailable')
    }
  })
  it('distinguishes initial loading, complete results, and partial results', () => {
    expect(researchSummary([scan({ phase: 'loading' })]).availability).toBe(
      'loading'
    )
    expect(researchSummary([scan({ result })])).toEqual({
      availability: 'ready',
      owned: 3,
      available: 1,
    })
    expect(
      researchSummary([scan({ result }), scan({ offline: true })])
    ).toEqual({ availability: 'partial', owned: 3, available: 1 })
    expect(researchAvailability(scan({ result, failedCabins: ['ruby'] }))).toBe(
      'partial'
    )
    expect(researchAvailability(scan({ result, offline: true }))).toBe(
      'partial'
    )
  })
})
