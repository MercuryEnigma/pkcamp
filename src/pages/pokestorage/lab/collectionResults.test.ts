import { describe, expect, it } from 'vitest'
import { MemoryFileStore } from '../../../services/storage/fileStore'
import { FileStoreProvider } from '../../../services/storage/fileStoreProvider'
import type { StoredCollectionResult } from '../../../services/storage'
import type { CabinScanStatus, CollectionDefinition } from './collectionTypes'
import { evaluateCollection } from './evaluateCollection'
import { isStale, mergeStatuses, toStoredResult } from './collectionResults'
import { scanned } from './testHelpers'

function definition(ids: string[]): CollectionDefinition {
  return {
    schemaVersion: '1',
    id: 'test-dex',
    name: 'Test Dex',
    metadata: { version: '1.0.0' },
    groups: [],
    pokemon: Object.fromEntries(ids.map((id) => [id, { species: Number(id) }])),
  }
}

const T1 = '2026-10-01T00:00:00.000Z'
const T2 = '2026-10-02T00:00:00.000Z'
const T3 = '2026-10-03T00:00:00.000Z'

function merge(
  def: CollectionDefinition,
  species: number[],
  previous: StoredCollectionResult | null,
  at: string
) {
  const matches = evaluateCollection(
    def,
    species.map((s) => scanned({ species: s }))
  )
  const merged = mergeStatuses(def, matches, previous, at)
  const cabins: CabinScanStatus[] = [
    { gameId: 'emerald', state: 'ok', updatedAt: new Date(T1), count: 1 },
  ]
  return toStoredResult(def, merged, cabins, at)
}

describe('mergeStatuses', () => {
  const def = definition(['1', '2', '3'])

  it('with no previous result every entry is owned or unseen', () => {
    const result = merge(def, [1], null, T1)
    expect(result.entries['1'].status).toBe('owned')
    expect(result.entries['2'].status).toBe('unseen')
    expect(result.entries['3']).toEqual({ status: 'unseen', matches: [] })
    expect([result.owned, result.seen, result.total]).toEqual([1, 0, 3])
  })

  it('unseen to owned sets both timestamps', () => {
    const result = merge(def, [1], null, T1)
    expect(result.entries['1']).toMatchObject({
      firstOwnedAt: T1,
      lastOwnedAt: T1,
    })
    expect(result.entries['1'].matches).toHaveLength(1)
  })

  it('owned to not matched becomes seen and keeps its timestamps', () => {
    const first = merge(def, [1], null, T1)
    const second = merge(def, [], first, T2)
    expect(second.entries['1']).toEqual({
      status: 'seen',
      firstOwnedAt: T1,
      lastOwnedAt: T1,
      matches: [],
    })
    expect([second.owned, second.seen]).toEqual([0, 1])
    // Seen is never lost by rescanning.
    const third = merge(def, [], second, T3)
    expect(third.entries['1']).toEqual(second.entries['1'])
  })

  it('seen to owned again updates lastOwnedAt only', () => {
    const first = merge(def, [1], null, T1)
    const seen = merge(def, [], first, T2)
    const again = merge(def, [1], seen, T3)
    expect(again.entries['1']).toMatchObject({
      status: 'owned',
      firstOwnedAt: T1,
      lastOwnedAt: T3,
    })
  })

  it('drops removed entries and starts new ones unseen', () => {
    const first = merge(def, [1, 2], null, T1)
    const next = merge(definition(['1', '4']), [], first, T2)
    expect(Object.keys(next.entries)).toEqual(['1', '4'])
    expect(next.entries['1'].status).toBe('seen')
    expect(next.entries['4']).toEqual({ status: 'unseen', matches: [] })
    expect(next.total).toBe(2)
  })
})

describe('stored result round trip', () => {
  it('comes back from storage unchanged', async () => {
    const def = definition(['1', '2'])
    const first = merge(def, [1, 2], null, T1)
    const result = merge(def, [2], first, T2)
    const provider = new FileStoreProvider(new MemoryFileStore(), {
      id: 'local',
      label: 'Test',
    })
    await provider.putCollectionResult(result)
    expect(await provider.getCollectionResult('test-dex')).toEqual(result)
    expect(result.sources).toEqual([{ gameId: 'emerald', saveUpdatedAt: T1 }])
    expect(result.entries['2'].matches[0]).toMatchObject({
      gameId: 'emerald',
      location: 'party',
      species: 2,
    })
    expect(result.entries['2'].matches[0]).not.toHaveProperty('moves')
  })
})

describe('isStale', () => {
  const def = definition(['1'])
  const saved = new Date(T1)
  const stored: StoredCollectionResult = merge(def, [1], null, T2)
  const fresh = { emerald: saved }

  it('is null when nothing changed', () => {
    expect(isStale(stored, def, ['emerald'], fresh)).toBeNull()
    // Older or equal saves, and Cabins without a save, do not matter.
    expect(
      isStale(stored, def, ['emerald', 'ruby'], {
        emerald: new Date(T1),
        ruby: null,
      })
    ).toBeNull()
  })

  it('reports a new collection version', () => {
    const changed = { ...def, metadata: { version: '1.1.0' } }
    expect(isStale(stored, changed, ['emerald'], fresh)).toBe('version')
  })

  it('reports a changed source set', () => {
    expect(isStale(stored, def, ['ruby'], { ruby: saved })).toBe('sources')
    expect(isStale(stored, def, [], fresh)).toBe('sources')
    expect(isStale(stored, def, ['emerald'], { emerald: null })).toBe('sources')
  })

  it('reports a selected Cabin with an unscanned save', () => {
    expect(
      isStale(stored, def, ['emerald', 'ruby'], { ...fresh, ruby: saved })
    ).toBe('unscanned-cabin')
  })

  it('reports a newer save', () => {
    expect(isStale(stored, def, ['emerald'], { emerald: new Date(T3) })).toBe(
      'newer-save'
    )
  })
})
