import { describe, expect, it, vi } from 'vitest'
import type { PokemonSaveAdapter, SaveGame } from '../pkhex'
import type { StorageProvider, StoredSave } from '../storage'
import { ActiveGameService } from './index'

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function save(label: string): SaveGame {
  const exact: SaveGame['version']['exact'] =
    label === 'ruby' ? 'Ruby' : 'Emerald'
  return {
    trainer: { name: label, id: 1, secretId: 2 },
    party: [],
    boxes: [],
    version: {
      exact,
      approximateGeneration: 3,
      aggregated: exact,
    },
    movePokemon: vi.fn(),
    movePokemonGroup: vi.fn(),
    setBoxSlot: vi.fn(),
    toBytes: () => new TextEncoder().encode(label),
    dispose: vi.fn(),
  }
}

function provider(
  getSave: StorageProvider['getSave'] = vi.fn(async () => null)
): StorageProvider {
  return {
    id: 'local',
    label: 'Test',
    getSave,
    getCamp: vi.fn(async () => ({ sites: [] })),
    putSave: vi.fn(async () => {}),
    saveCamp: vi.fn(async () => {}),
  } as unknown as StorageProvider
}

describe('ActiveGameService', () => {
  it('loads a selected save and Camp once for concurrent consumers', async () => {
    const stored: StoredSave = {
      bytes: new TextEncoder().encode('ruby'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    }
    const storage = provider(vi.fn(async () => stored))
    const loaded = save('ruby')
    const adapter = {
      load: vi.fn(() => loaded),
    } as unknown as PokemonSaveAdapter
    const service = new ActiveGameService()

    const first = service.select('ruby', storage, adapter)
    const second = service.select('ruby', storage, adapter)
    expect(first).toBe(second)
    await first
    await service.select('ruby', storage, adapter)

    expect(storage.getSave).toHaveBeenCalledOnce()
    expect(storage.getCamp).toHaveBeenCalledOnce()
    expect(adapter.load).toHaveBeenCalledOnce()
    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      gameId: 'ruby',
      save: loaded,
      error: null,
    })
  })

  it('loads only Camp in the explicit no-game state', async () => {
    const storage = provider()
    const adapter = { load: vi.fn() } as unknown as PokemonSaveAdapter
    const service = new ActiveGameService()
    await service.select(null, storage, adapter)

    expect(storage.getSave).not.toHaveBeenCalled()
    expect(storage.getCamp).toHaveBeenCalledOnce()
    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      gameId: null,
      save: null,
    })
  })

  it('ignores and disposes a stale load after the selection changes', async () => {
    const ruby = deferred<StoredSave | null>()
    const firstStorage = provider(() => ruby.promise)
    const secondStorage = provider(async () => ({
      bytes: new TextEncoder().encode('emerald'),
      updatedAt: new Date(),
    }))
    const stale = save('ruby')
    const current = save('emerald')
    const adapter = {
      load: vi.fn((bytes: Uint8Array) =>
        new TextDecoder().decode(bytes) === 'ruby' ? stale : current
      ),
    } as unknown as PokemonSaveAdapter
    const service = new ActiveGameService()

    const oldLoad = service.select('ruby', firstStorage, adapter)
    await service.select('emerald', secondStorage, adapter)
    ruby.resolve({
      bytes: new TextEncoder().encode('ruby'),
      updatedAt: new Date(),
    })
    await oldLoad

    expect(stale.dispose).toHaveBeenCalledOnce()
    expect(current.dispose).not.toHaveBeenCalled()
    expect(service.getSnapshot()).toMatchObject({
      status: 'ready',
      gameId: 'emerald',
      save: current,
    })
  })

  it('updates memory only after successful persistence', async () => {
    const loaded = save('ruby')
    const storage = provider(async () => ({
      bytes: new Uint8Array([1]),
      updatedAt: new Date(),
    }))
    const adapter = { load: () => loaded } as unknown as PokemonSaveAdapter
    const service = new ActiveGameService()
    await service.select('ruby', storage, adapter)
    const before = service.getSnapshot().revision

    vi.mocked(storage.putSave).mockRejectedValueOnce(new Error('offline'))
    await expect(service.save()).rejects.toThrow('offline')
    expect(service.getSnapshot()).toMatchObject({
      revision: before + 1,
      saveDirty: true,
    })

    await service.save()
    expect(storage.putSave).toHaveBeenLastCalledWith(
      'ruby',
      new TextEncoder().encode('ruby')
    )
    expect(service.getSnapshot()).toMatchObject({
      revision: before + 2,
      saveDirty: false,
    })
  })

  it('discards save and Camp edits from committed memory without refetching', async () => {
    const original = save('ruby')
    const restored = save('ruby')
    const storage = provider(
      vi.fn(async () => ({
        bytes: new TextEncoder().encode('ruby'),
        updatedAt: new Date(),
      }))
    )
    const adapter = {
      load: vi.fn().mockReturnValueOnce(original).mockReturnValueOnce(restored),
    } as unknown as PokemonSaveAdapter
    const service = new ActiveGameService()
    await service.select('ruby', storage, adapter)

    service.editSave(() => {})
    service.editCamp((camp) => camp.sites.push([]))
    expect(service.getSnapshot()).toMatchObject({
      saveDirty: true,
      campDirty: true,
      dirty: true,
    })

    service.discardDraft()

    expect(storage.getSave).toHaveBeenCalledOnce()
    expect(storage.getCamp).toHaveBeenCalledOnce()
    expect(original.dispose).toHaveBeenCalledOnce()
    expect(service.getSnapshot()).toMatchObject({
      save: restored,
      camp: { sites: [] },
      saveDirty: false,
      campDirty: false,
      dirty: false,
    })
  })

  it('commits save and Camp independently and keeps failed work dirty', async () => {
    const storage = provider(async () => ({
      bytes: new TextEncoder().encode('ruby'),
      updatedAt: new Date(),
    }))
    vi.mocked(storage.saveCamp).mockRejectedValueOnce(new Error('camp offline'))
    const service = new ActiveGameService()
    await service.select('ruby', storage, {
      load: () => save('ruby'),
    } as unknown as PokemonSaveAdapter)
    service.editSave(() => {})
    service.editCamp((camp) => camp.sites.push([]))

    const result = await service.commitDraft()

    expect(result.save.status).toBe('saved')
    expect(result.camp).toMatchObject({ status: 'failed' })
    expect(service.getSnapshot()).toMatchObject({
      saveDirty: false,
      campDirty: true,
      dirty: true,
    })
  })

  it('announces successful writes and validates secondary saves', async () => {
    const storage = provider(async () => ({
      bytes: new TextEncoder().encode('ruby'),
      updatedAt: new Date(),
    }))
    const service = new ActiveGameService()
    const changes = vi.fn()
    service.subscribeChanges(changes)
    await service.select('ruby', storage, {
      load: (bytes: Uint8Array) =>
        save(
          new TextDecoder().decode(bytes) === 'emerald' ? 'emerald' : 'ruby'
        ),
    } as unknown as PokemonSaveAdapter)

    await service.writeSecondarySave(
      'emerald',
      new TextEncoder().encode('emerald')
    )

    expect(storage.putSave).toHaveBeenCalledWith(
      'emerald',
      new TextEncoder().encode('emerald')
    )
    expect(changes).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'save', gameId: 'emerald' })
    )
  })

  it('does not publish a completed write into a newer selection', async () => {
    const write = deferred<void>()
    const firstStorage = provider(async () => ({
      bytes: new TextEncoder().encode('ruby'),
      updatedAt: new Date(),
    }))
    vi.mocked(firstStorage.putSave).mockReturnValueOnce(write.promise)
    const secondStorage = provider(async () => ({
      bytes: new TextEncoder().encode('emerald'),
      updatedAt: new Date(),
    }))
    const service = new ActiveGameService()
    const adapter = {
      load: (bytes: Uint8Array) => save(new TextDecoder().decode(bytes)),
    } as unknown as PokemonSaveAdapter
    await service.select('ruby', firstStorage, adapter)
    service.editSave(() => {})
    const committing = service.commitDraft()

    await service.select('emerald', secondStorage, adapter)
    write.resolve()
    await committing

    expect(service.getSnapshot()).toMatchObject({
      provider: secondStorage,
      gameId: 'emerald',
      saveDirty: false,
    })
  })

  it('publishes parse failures instead of remaining stuck loading', async () => {
    const storage = provider(async () => ({
      bytes: new Uint8Array([1]),
      updatedAt: new Date(),
    }))
    const adapter = {
      load: vi.fn(() => {
        throw new Error('invalid save')
      }),
    } as unknown as PokemonSaveAdapter
    const service = new ActiveGameService()

    await expect(service.select('ruby', storage, adapter)).rejects.toThrow(
      'invalid save'
    )
    expect(service.getSnapshot()).toMatchObject({
      status: 'error',
      gameId: 'ruby',
      save: null,
      error: new Error('invalid save'),
    })
  })
})
