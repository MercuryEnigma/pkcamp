import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { FileStoreProvider, MemoryFileStore } from '../storage'
import { shareStorageLoads } from '../storage/sharedLoads'
import {
  GuideService,
  extractDirect,
  UnsupportedRomError,
  type PokedexDataset,
} from './index'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => {
    resolve = yes
  })
  return { promise, resolve }
}

function rom(code = 'BPEE') {
  const bytes = new Uint8Array(0xc0)
  bytes.set(new TextEncoder().encode(code), 0xac)
  return { bytes, extension: 'gba' }
}

function provider() {
  return shareStorageLoads(
    new FileStoreProvider(new MemoryFileStore(), { id: 'local', label: 'Test' })
  )
}

let dataset: PokedexDataset
const services: GuideService[] = []
function service(extractor: ConstructorParameters<typeof GuideService>[0]) {
  const value = new GuideService(extractor)
  services.push(value)
  return value
}

beforeAll(async () => {
  const bytes = new Uint8Array(0x330000)
  bytes.set(new TextEncoder().encode('BPEE'), 0xac)
  bytes.set(
    [...'BULBASAUR'].map((letter) => 0xbb + letter.charCodeAt(0) - 65),
    0x3185c8 + 11
  )
  bytes[0x3185c8 + 20] = 0xff
  bytes.set([45, 49, 49], 0x3203cc + 28)
  dataset = await extractDirect(bytes)
})
afterEach(() => {
  for (const value of services.splice(0)) value.dispose()
})

describe('GuideService selection lifecycle', () => {
  it('loads at selection and retains one immutable dataset across repeated selection and queries', async () => {
    const storage = provider()
    await storage.putRom('emerald', rom())
    const read = vi.spyOn(storage, 'getRom')
    const extractor = vi.fn(async () => structuredClone(dataset))
    const guide = service(extractor)
    await guide.select('emerald', storage)
    const snapshot = guide.getSnapshot()
    await guide.select('emerald', storage)
    expect(guide.getSnapshot()).toBe(snapshot)
    expect(guide.getSpecies(1)?.name).toBe('BULBASAUR')
    expect(guide.searchSpecies('bulba')).toHaveLength(1)
    expect(Object.isFrozen(guide.getSpecies(1)?.stats)).toBe(true)
    expect(read).toHaveBeenCalledTimes(1)
    expect(extractor).toHaveBeenCalledTimes(1)
    expect(await storage.getPokedex('emerald')).not.toBeNull()
  })

  it('shares initialization and publishes ready before sidecar persistence finishes', async () => {
    const storage = provider()
    await storage.putRom('emerald', rom())
    const writing = deferred<void>()
    vi.spyOn(storage, 'putPokedex').mockImplementation(() => writing.promise)
    const extractor = vi.fn(async () => structuredClone(dataset))
    const guide = service(extractor)
    const first = guide.select('emerald', storage)
    const second = guide.select('emerald', storage)
    expect(second).toBe(first)
    await vi.waitFor(() => expect(guide.getSnapshot().status).toBe('ready'))
    expect(guide.getSpecies(1)).toBeDefined()
    writing.resolve()
    await first
    expect(extractor).toHaveBeenCalledTimes(1)
  })

  it('rejects an obsolete extraction and aborts its worker when the game changes', async () => {
    const storage = provider()
    await storage.putRom('emerald', rom())
    await storage.putRom('ruby', rom('AXVE'))
    const old = deferred<PokedexDataset>()
    const extractor = vi
      .fn<typeof import('./extractor').extract>()
      .mockImplementationOnce(() => old.promise)
      .mockResolvedValueOnce({
        ...structuredClone(dataset),
        game: { ...dataset.game, id: 'ruby' },
      })
    const guide = service(extractor)
    const first = guide.select('emerald', storage)
    await vi.waitFor(() => expect(extractor).toHaveBeenCalledTimes(1))
    const signal = extractor.mock.calls[0][2]
    await guide.select('ruby', storage)
    expect(signal?.aborted).toBe(true)
    old.resolve(structuredClone(dataset))
    await first
    expect(guide.getSnapshot().gameId).toBe('ruby')
    expect(guide.getSnapshot().dataset?.game.id).toBe('ruby')
    expect(await storage.getPokedex('emerald')).toBeNull()
  })

  it('reloads after ROM replacement and removes retained data after ROM removal', async () => {
    const storage = provider()
    await storage.putRom('emerald', rom())
    const extractor = vi.fn(async () => structuredClone(dataset))
    const guide = service(extractor)
    await guide.select('emerald', storage)
    await storage.putRom('emerald', rom())
    await guide.select('emerald', storage)
    expect(extractor).toHaveBeenCalledTimes(2)
    await storage.discardRom('emerald')
    await guide.select('emerald', storage)
    expect(guide.getSnapshot().status).toBe('unavailable')
    expect(guide.getSpecies(1)).toBeUndefined()
  })

  it('uses provider identity and ignores obsolete results even when provider IDs match', async () => {
    const first = provider()
    const second = provider()
    await first.putRom('emerald', rom())
    const extractor = vi.fn(async () => structuredClone(dataset))
    const guide = service(extractor)
    await guide.select('emerald', first)
    await guide.select('emerald', second)
    expect(guide.getSnapshot().status).toBe('unavailable')
    expect(guide.getSnapshot().dataset).toBeNull()
  })

  it('restores a valid sidecar in a new service and regenerates malformed sidecars', async () => {
    const storage = provider()
    const bytes = new Uint8Array(0x330000)
    bytes.set(new TextEncoder().encode('BPEE'), 0xac)
    bytes.set(
      [...'BULBASAUR'].map((letter) => 0xbb + letter.charCodeAt(0) - 65),
      0x3185c8 + 11
    )
    bytes[0x3185c8 + 20] = 0xff
    bytes.set([45, 49, 49], 0x3203cc + 28)
    await storage.putRom('emerald', { bytes, extension: 'gba' })
    const first = service(extractDirect)
    await first.select('emerald', storage)
    const extractor = vi.fn(async () => structuredClone(dataset))
    const next = service(extractor)
    await next.select('emerald', storage)
    expect(next.getSnapshot().status).toBe('ready')
    expect(extractor).not.toHaveBeenCalled()
    await storage.putPokedex('emerald', {
      bytes: new TextEncoder().encode('{"schemaVersion":1}'),
    })
    await next.refresh()
    expect(extractor).toHaveBeenCalledTimes(1)
  })

  it('keeps reference data usable when persistence fails and distinguishes worker failures from unsupported ROMs', async () => {
    const storage = provider()
    await storage.putRom('emerald', rom())
    vi.spyOn(storage, 'putPokedex').mockRejectedValue(new Error('offline'))
    const extractor = vi.fn(async () => structuredClone(dataset))
    const guide = service(extractor)
    await guide.select('emerald', storage)
    expect(guide.getSnapshot().status).toBe('ready')
    expect(guide.getSnapshot().dataset?.warnings).toContainEqual({
      code: 'storage-unavailable',
    })
    extractor.mockRejectedValueOnce(new Error('Worker failed'))
    await guide.refresh()
    expect(guide.getSnapshot().status).toBe('error')
    extractor.mockRejectedValueOnce(new UnsupportedRomError('Unknown layout'))
    await guide.refresh()
    expect(guide.getSnapshot().status).toBe('unsupported')
  })

  it('invalidates retained data when metadata changes and ignores writes to other games', async () => {
    const storage = provider()
    await storage.putRom('emerald', rom())
    const extractor = vi.fn<typeof import('./extractor').extract>(async () =>
      structuredClone(dataset)
    )
    const guide = service(extractor)
    await guide.select('emerald', storage)
    const initial = guide.getSnapshot()
    await storage.putRom('ruby', rom('AXVE'))
    expect(guide.getSnapshot()).toBe(initial)
    await guide.select('emerald', storage, { metadata: 'custom table anchors' })
    expect(extractor).toHaveBeenCalledTimes(2)
    expect(extractor.mock.calls[1]?.[1]).toEqual({
      metadata: 'custom table anchors',
    })
  })
})
