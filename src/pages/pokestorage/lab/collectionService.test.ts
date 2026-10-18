import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMockPokemonSaveBackend,
  encodeFixtureSaveBytes,
  encodePokemonFileBytes,
  initializePokemonSaveAdapter,
} from '../../../services/pkhex'
import {
  emptyCamp,
  FileStoreProvider,
  MemoryFileStore,
  type StorageProvider,
} from '../../../services/storage'
import {
  loadCollectionSources,
  subscribeCollectionUpdates,
  updateAllCollections,
  updateCollections,
} from './collectionService'
import type { CollectionDefinition } from './collectionTypes'
import { makeNode } from './testHelpers'

const adapter = initializePokemonSaveAdapter({
  backend: createMockPokemonSaveBackend(),
})

// The Emerald fixture holds a Pikachu and an Eevee.
const definition: CollectionDefinition = {
  schemaVersion: '1',
  id: 'test',
  name: 'Test',
  metadata: { version: '1' },
  groups: [],
  pokemon: {
    pikachu: { species: 25 },
    eevee: { species: 133 },
    mew: { species: 151 },
  },
}

let provider: StorageProvider
beforeEach(() => {
  provider = new FileStoreProvider(new MemoryFileStore(), {
    id: 'local',
    label: 'Test',
  })
})

async function update(
  selected: Parameters<typeof loadCollectionSources>[1] = null
) {
  return updateCollections({
    provider,
    adapter,
    definitions: [definition],
    sources: await loadCollectionSources(provider, selected),
  })
}

const statuses = async () =>
  Object.fromEntries(
    Object.entries((await provider.getCollectionResult('test'))!.entries).map(
      ([id, entry]) => [id, entry.status]
    )
  )

async function addMewToCamp() {
  const camp = emptyCamp()
  camp.sites[0][0] = {
    id: 'mew',
    fileName: 'mew.pk3',
    bytes: encodePokemonFileBytes(makeNode({ species: 151 })),
    importedAt: '2026-10-01',
  }
  await provider.saveCamp(3, camp)
}

describe('updateCollections', () => {
  it('marks matches in saves and Camp Sites as owned and stores them', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    await addMewToCamp()
    const outcome = await update()
    expect(outcome.updated).toEqual(['test'])
    expect(outcome.unsaved).toBe(false)
    expect(await statuses()).toEqual({
      pikachu: 'owned',
      eevee: 'owned',
      mew: 'owned',
    })
  })

  it('turns owned entries into seen once no source holds them, and back', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    await addMewToCamp()
    await update()

    await provider.saveCamp(3, emptyCamp())
    await update()
    expect(await statuses()).toEqual({
      pikachu: 'owned',
      eevee: 'owned',
      mew: 'seen',
    })

    // With no sources left at all, the result is still stored.
    await provider.discardSave('emerald')
    const outcome = await update()
    expect(outcome.unsaved).toBe(false)
    expect(await statuses()).toEqual({
      pikachu: 'seen',
      eevee: 'seen',
      mew: 'seen',
    })

    await addMewToCamp()
    await update()
    expect((await statuses()).mew).toBe('owned')
  })

  it('leaves fresh results alone', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    await update()
    const load = vi.spyOn(adapter, 'load')
    expect((await update()).updated).toEqual([])
    expect(load).not.toHaveBeenCalled()
    load.mockRestore()
  })

  it('does not store a partial scan', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    await update()
    await provider.putSave('ruby', new Uint8Array([1, 2, 3]))
    const outcome = await update()
    expect(outcome.unsaved).toBe(true)
    expect(outcome.cabins.find((c) => c.gameId === 'ruby')?.state).toBe('error')
    expect((await provider.getCollectionResult('test'))!.sources).toEqual([
      expect.objectContaining({ gameId: 'emerald' }),
    ])
  })

  it('waits for PKHeX before scanning', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    const outcome = await updateCollections({
      provider,
      adapter: null,
      definitions: [definition],
      sources: await loadCollectionSources(provider, null),
    })
    expect(outcome.waitingForPkHex).toBe(true)
    expect(await provider.getCollectionResult('test')).toBeNull()
  })

  it('tells listeners when results are stored, with the caller as origin', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeCollectionUpdates(provider, listener)
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    const origin = {}
    await updateCollections({
      provider,
      adapter,
      definitions: [definition],
      sources: await loadCollectionSources(provider, null),
      origin,
    })
    await update()
    expect(listener.mock.calls).toEqual([[origin]])
    unsubscribe()
  })

  it('runs one update at a time per storage', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    const [first, second] = await Promise.all([update(), update()])
    expect(first.updated).toEqual(['test'])
    expect(second.updated).toEqual([])
  })
})

describe('updateAllCollections', () => {
  it('updates built-in and uploaded collections from the stored selection', async () => {
    await provider.putSave('emerald', encodeFixtureSaveBytes('fixture:emerald'))
    await provider.putLabCollection(definition.id, definition)
    const outcome = await updateAllCollections(provider, adapter)
    expect(outcome.updated).toContain('test')
    expect(outcome.updated).toContain('gen3-living-dex')
    expect((await statuses()).pikachu).toBe('owned')
  })
})
