import { describe, expect, it, vi } from 'vitest'
import { FileStoreProvider } from './fileStoreProvider'
import { MemoryFileStore } from './fileStore'
import {
  shareStorageLoads,
  settingsSnapshot,
  subscribeSettings,
} from './sharedLoads'

function setup() {
  const raw = new FileStoreProvider(new MemoryFileStore(), {
    id: 'local',
    label: 'Test',
  })
  return { raw, provider: shareStorageLoads(raw) }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('shared storage loading', () => {
  it('shares overlapping save reads but gives editors independent byte copies', async () => {
    const { raw, provider } = setup()
    await raw.putSave('emerald', new Uint8Array([1, 2]))
    const read = vi.spyOn(raw, 'getSave')
    const [first, second] = await Promise.all([
      provider.getSave('emerald'),
      provider.getSave('emerald'),
    ])
    expect(read).toHaveBeenCalledTimes(1)
    first!.bytes[0] = 9
    expect(second!.bytes[0]).toBe(1)
    expect(first!.updatedAt).toBeInstanceOf(Date)
    await provider.getSave('emerald')
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('isolates providers and preserves private-field methods', async () => {
    const first = setup().provider
    const second = setup().provider
    expect(shareStorageLoads(first)).toBe(first)
    await first.saveLabSettings({ sources: ['emerald'] })
    expect(await first.getLabSettings()).toEqual({ sources: ['emerald'] })
    expect(await second.getLabSettings()).toEqual({ sources: null })
    await first.saveSettings({ spriteSourceId: 'first' })
    expect(await second.getSettings()).toEqual({ spriteSourceId: null })
  })

  it('notifies shared settings consumers after successful writes only', async () => {
    const { raw, provider } = setup()
    const changed = vi.fn()
    const unsubscribe = subscribeSettings(provider, changed)
    await provider.getSettings()
    changed.mockClear()
    await provider.saveSettings({ spriteSourceId: 'new' })
    expect(changed).toHaveBeenCalledTimes(1)
    expect(settingsSnapshot(provider).settings?.spriteSourceId).toBe('new')
    const read = vi.spyOn(raw, 'getSettings')
    expect(await provider.getSettings()).toEqual({ spriteSourceId: 'new' })
    expect(read).not.toHaveBeenCalled()
    vi.spyOn(raw, 'saveSettings').mockRejectedValueOnce(new Error('offline'))
    await expect(
      provider.saveSettings({ spriteSourceId: 'failed' })
    ).rejects.toThrow('offline')
    expect(settingsSnapshot(provider).settings?.spriteSourceId).toBe('new')
    expect(changed).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('does not let an old settings response overwrite a newer preference', async () => {
    const { raw, provider } = setup()
    const old = deferred<{ spriteSourceId: string | null }>()
    vi.spyOn(raw, 'getSettings').mockReturnValueOnce(old.promise)
    const pending = provider.getSettings()
    await Promise.resolve()
    await provider.saveSettings({ spriteSourceId: 'new' })
    old.resolve({ spriteSourceId: 'old' })
    expect(await pending).toEqual({ spriteSourceId: 'new' })
    expect(settingsSnapshot(provider).settings?.spriteSourceId).toBe('new')
  })

  it('retries failed reads and does not merge reads across a save write', async () => {
    const { raw, provider } = setup()
    const old = deferred<null>()
    const read = vi.spyOn(raw, 'getSave').mockReturnValueOnce(old.promise)
    const pending = provider.getSave('emerald')
    await Promise.resolve()
    await provider.putSave('emerald', new Uint8Array([7]))
    expect((await provider.getSave('emerald'))?.bytes[0]).toBe(7)
    old.resolve(null)
    expect(await pending).toBeNull()
    read.mockRejectedValueOnce(new Error('offline'))
    await expect(provider.getSave('emerald')).rejects.toThrow('offline')
    expect((await provider.getSave('emerald'))?.bytes[0]).toBe(7)
  })

  it('shares Camp reads without sharing mutable positions', async () => {
    const { raw, provider } = setup()
    const read = vi.spyOn(raw, 'getCamp')
    const [first, second] = await Promise.all([
      provider.getCamp(3),
      provider.getCamp(3),
    ])
    first.sites.pop()
    expect(second.sites).toHaveLength(10)
    expect(read).toHaveBeenCalledTimes(1)
  })
})
