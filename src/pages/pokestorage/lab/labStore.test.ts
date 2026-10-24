import { beforeEach, describe, expect, it } from 'vitest'
import { MemoryFileStore } from '../../../services/storage/fileStore'
import { FileStoreProvider } from '../../../services/storage/fileStoreProvider'
import type { CollectionDefinition } from './collectionTypes'
import {
  loadSelectedSources,
  loadUploadedCollections,
  saveSelectedSources,
  saveUploadedCollection,
} from './labStore'

const upload: CollectionDefinition = {
  schemaVersion: '1',
  id: 'my-dex',
  name: 'My Dex',
  metadata: { version: '1.0.0' },
  groups: [{ id: 'all', name: 'All', pokemon: ['pikachu'] }],
  pokemon: { pikachu: { species: 25 } },
}

let provider: FileStoreProvider
beforeEach(() => {
  provider = new FileStoreProvider(new MemoryFileStore(), {
    id: 'local',
    label: 'Test',
  })
})

describe('Lab data in storage', () => {
  it('round trips the source choice, ignoring unknown sources', async () => {
    expect(await loadSelectedSources(provider)).toBeNull()
    await saveSelectedSources(provider, ['camp', 'emerald'])
    // Display order, not save order.
    expect(await loadSelectedSources(provider)).toEqual(['emerald', 'camp'])
    await provider.saveLabSettings({ sources: ['emerald', 'pinball'] })
    expect(await loadSelectedSources(provider)).toBeNull()
  })

  it('loads valid uploaded collections and skips invalid ones', async () => {
    await saveUploadedCollection(provider, upload)
    await provider.putLabCollection('broken', { id: 'broken' })
    expect((await loadUploadedCollections(provider)).map((d) => d.id)).toEqual([
      'my-dex',
    ])
  })
})
