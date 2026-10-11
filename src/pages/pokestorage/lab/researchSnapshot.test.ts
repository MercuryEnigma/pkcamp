import { describe, expect, it, vi } from 'vitest'
import {
  createMockPokemonSaveBackend,
  encodeFixtureSaveBytes,
  initializePokemonSaveAdapter,
} from '../../../services/pkhex'
import type { StorageProvider } from '../../../services/storage'
import type { CollectionDefinition } from './collectionTypes'
import {
  evaluateResearchSnapshot,
  scanResearchSnapshot,
} from './researchSnapshot'
import { scanned } from './testHelpers'

const definition = (id: string, species = 1): CollectionDefinition => ({
  schemaVersion: '1',
  id,
  name: id,
  metadata: { version: '1' },
  groups: [],
  pokemon: { entry: { species } },
})
describe('shared research snapshot', () => {
  it('decodes each Cabin once and reuses its Pokémon for multiple collections', async () => {
    const adapter = initializePokemonSaveAdapter({
      backend: createMockPokemonSaveBackend(),
    })
    const load = vi.spyOn(adapter, 'load')
    const getSave = vi.fn()
    const provider = { getSave } as unknown as StorageProvider
    const snapshot = await scanResearchSnapshot(
      provider,
      adapter,
      ['emerald'],
      {
        emerald: {
          bytes: encodeFixtureSaveBytes('fixture:emerald'),
          updatedAt: new Date('2026-10-01'),
        },
      }
    )
    const species = snapshot.pokemon[0].node.species
    const results = evaluateResearchSnapshot(
      [definition('one', species), definition('two', species)],
      snapshot,
      {},
      '2026-10-01T00:00:00Z'
    )
    expect(load).toHaveBeenCalledTimes(1)
    expect(getSave).not.toHaveBeenCalled()
    expect(results.one.owned).toBe(1)
    expect(results.two.entries.entry.matches).toEqual(
      results.one.entries.entry.matches
    )
  })
  it('clears old matching locations while retaining ownership history after a save changes', () => {
    const definitions = [definition('one')]
    const first = evaluateResearchSnapshot(
      definitions,
      { pokemon: [scanned()], cabins: [] },
      {},
      '2026-10-01T00:00:00Z'
    )
    const second = evaluateResearchSnapshot(
      definitions,
      { pokemon: [], cabins: [] },
      first,
      '2026-10-02T00:00:00Z'
    )
    expect(second.one.owned).toBe(0)
    expect(second.one.entries.entry.status).toBe('seen')
    expect(second.one.entries.entry.matches).toEqual([])
    expect(second.one.entries.entry.firstOwnedAt).toBe(
      first.one.entries.entry.firstOwnedAt
    )
  })
})
