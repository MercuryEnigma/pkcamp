import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFileStore } from '../../../services/storage/fileStore'
import { FileStoreProvider } from '../../../services/storage/fileStoreProvider'
import type { CollectionDefinition } from './collectionTypes'
import {
  loadSelectedSources,
  loadUploadedCollections,
  migrateBrowserLabData,
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
let browser: Map<string, string>

beforeEach(() => {
  provider = new FileStoreProvider(new MemoryFileStore(), {
    id: 'local',
    label: 'Test',
  })
  browser = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => browser.get(key) ?? null,
    setItem: (key: string, value: string) => browser.set(key, value),
    removeItem: (key: string) => browser.delete(key),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
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

describe('migrateBrowserLabData', () => {
  it('moves browser-only data into storage, adds Camp Sites, and clears it', async () => {
    browser.set('pkcamp.lab.sources', JSON.stringify(['ruby']))
    browser.set('pkcamp.lab.uploadedCollections', JSON.stringify([upload]))
    await migrateBrowserLabData(provider)
    expect(await loadSelectedSources(provider)).toEqual(['ruby', 'camp'])
    expect((await loadUploadedCollections(provider)).map((d) => d.id)).toEqual([
      'my-dex',
    ])
    expect(browser.size).toBe(0)
  })

  it('never overwrites data already in storage', async () => {
    await saveSelectedSources(provider, ['emerald'])
    await saveUploadedCollection(provider, { ...upload, name: 'Stored' })
    browser.set('pkcamp.lab.sources', JSON.stringify(['ruby']))
    browser.set(
      'pkcamp.lab.uploadedCollections',
      JSON.stringify([{ ...upload, name: 'Browser' }])
    )
    await migrateBrowserLabData(provider)
    expect(await loadSelectedSources(provider)).toEqual(['emerald'])
    expect((await loadUploadedCollections(provider))[0].name).toBe('Stored')
  })

  it('does nothing when there is no browser data', async () => {
    await migrateBrowserLabData(provider)
    expect(await loadSelectedSources(provider)).toBeNull()
  })
})
