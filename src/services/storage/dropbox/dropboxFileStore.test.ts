import { describe, expect, it, vi } from 'vitest'
import { FileStoreProvider } from '../fileStoreProvider'
import { StorageUnavailableError } from '../types'
import {
  DropboxFileStore,
  dropboxTime,
  escapeHeaderJson,
  type DropboxTokenProvider,
} from './dropboxFileStore'
import { createFakeDropbox } from './fakeDropbox'

const tokens = (): DropboxTokenProvider & { calls: boolean[] } => {
  const calls: boolean[] = []
  return {
    calls,
    getAccessToken: async (force = false) => {
      calls.push(force)
      return force ? 'fresh' : 'stale'
    },
  }
}

const sleep = async () => {}

describe('helpers', () => {
  it('escapes non-ASCII header characters', () => {
    expect(escapeHeaderJson({ path: '/é☃' })).toBe('{"path":"/\\u00e9\\u2603"}')
  })

  it('formats times without milliseconds', () => {
    expect(dropboxTime(new Date('2026-10-03T12:00:00.789Z'))).toBe(
      '2026-10-03T12:00:00Z'
    )
  })
})

describe('DropboxFileStore requests', () => {
  it('writes with overwrite arguments and reads back with modified time', async () => {
    const fake = createFakeDropbox()
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    await store.write(
      'saves/a/b.sav',
      new Uint8Array([1, 2]),
      new Date('2026-10-03T12:00:00.500Z')
    )

    const upload = fake.requests[0]
    expect(upload.url).toBe('https://content.dropboxapi.com/2/files/upload')
    expect(upload.headers.get('Authorization')).toBe('Bearer stale')
    expect(JSON.parse(upload.headers.get('Dropbox-API-Arg')!)).toEqual({
      path: '/saves/a/b.sav',
      mode: 'overwrite',
      autorename: false,
      mute: true,
      client_modified: '2026-10-03T12:00:00Z',
    })

    // A fresh store has nothing cached, so this read downloads.
    const reader = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    const file = await reader.read('saves/a/b.sav')
    expect([...file!.bytes]).toEqual([1, 2])
    expect(file!.modified.toISOString()).toBe('2026-10-03T12:00:00.000Z')
    expect(fake.requests[1].url).toBe(
      'https://content.dropboxapi.com/2/files/download'
    )
  })

  it('treats a missing file, folder, and delete target as not found', async () => {
    const fake = createFakeDropbox()
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    expect(await store.read('nope')).toBeNull()
    expect(await store.list('nope')).toEqual([])
    await expect(store.delete('nope')).resolves.toBeUndefined()
  })

  it('lists the root as an empty path and follows paging', async () => {
    const fake = createFakeDropbox(2)
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    for (const name of ['a.json', 'b.json', 'c/x.sav']) {
      await store.write(name, new Uint8Array([0]))
    }
    const entries = await store.list('')
    expect(entries).toEqual([
      { name: 'a.json', kind: 'file' },
      { name: 'b.json', kind: 'file' },
      { name: 'c', kind: 'folder' },
    ])
    const list = fake.requests.find((r) => r.url.endsWith('/list_folder'))!
    expect(JSON.parse(list.body as string)).toEqual({
      path: '',
      recursive: false,
    })
    expect(fake.requests.some((r) => r.url.endsWith('/continue'))).toBe(true)
  })

  it('prefetches from one recursive listing, across pages', async () => {
    const fake = createFakeDropbox(2)
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    await store.write('settings.json', new Uint8Array([1]))
    await store.write('saves/ruby/2026-10-03/current.sav', new Uint8Array([2]))
    await store.write('camp/gen-3/camp.json', new Uint8Array([3]))
    const seen: string[] = []

    await store.prefetch((paths) => {
      seen.push(...paths)
      return []
    })

    expect(seen.sort()).toEqual([
      'camp/gen-3/camp.json',
      'saves/ruby/2026-10-03/current.sav',
      'settings.json',
    ])
    const listCall = fake.requests.find((request) =>
      request.url.endsWith('/list_folder')
    )
    expect(JSON.parse(listCall!.body as string)).toEqual({
      path: '',
      recursive: true,
    })
  })

  it('deletes folders recursively', async () => {
    const fake = createFakeDropbox()
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    await store.write('d/x', new Uint8Array([1]))
    await store.delete('d')
    expect(fake.files.size).toBe(0)
  })
})

describe('DropboxFileStore failures', () => {
  it('waits for Retry-After on 429 and retries', async () => {
    const wait = vi.fn(async () => {})
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '3' } })
      )
      .mockResolvedValueOnce(new Response('{}'))
    const store = new DropboxFileStore(tokens(), {
      fetch: fetchFn,
      sleep: wait,
    })
    await store.write('x', new Uint8Array())
    expect(wait).toHaveBeenCalledWith(3000)
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('gives up after repeated 429s', async () => {
    const fetchFn = vi.fn(async () => new Response('', { status: 429 }))
    const store = new DropboxFileStore(tokens(), { fetch: fetchFn, sleep })
    await expect(store.read('x')).rejects.toBeInstanceOf(
      StorageUnavailableError
    )
    expect(fetchFn).toHaveBeenCalledTimes(4)
  })

  it('refreshes the token once on 401 and retries', async () => {
    const t = tokens()
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}'))
    const store = new DropboxFileStore(t, { fetch: fetchFn, sleep })
    await store.write('x', new Uint8Array())
    expect(t.calls).toEqual([false, true])
    expect(fetchFn.mock.calls[1][1].headers.Authorization).toBe('Bearer fresh')
  })

  it('reports a second 401 as unavailable', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 401 }))
    const store = new DropboxFileStore(tokens(), { fetch: fetchFn, sleep })
    await expect(store.write('x', new Uint8Array())).rejects.toBeInstanceOf(
      StorageUnavailableError
    )
    expect(fetchFn).toHaveBeenCalledTimes(2)
  })

  it('turns network errors and 5xx into StorageUnavailableError', async () => {
    const offline = new DropboxFileStore(tokens(), {
      fetch: async () => {
        throw new TypeError('Failed to fetch')
      },
      sleep,
    })
    const error = await offline.read('x').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(StorageUnavailableError)
    expect((error as StorageUnavailableError).providerId).toBe('dropbox')

    const broken = new DropboxFileStore(tokens(), {
      fetch: async () => new Response('', { status: 503 }),
      sleep,
    })
    await expect(broken.list('')).rejects.toBeInstanceOf(
      StorageUnavailableError
    )
  })

  it('passes through token provider failures', async () => {
    const store = new DropboxFileStore(
      {
        getAccessToken: async () => {
          throw new StorageUnavailableError('dropbox', 'expired')
        },
      },
      { fetch: async () => new Response('{}'), sleep }
    )
    await expect(store.read('x')).rejects.toThrow('expired')
  })
})

describe('FileStoreProvider over DropboxFileStore', () => {
  it('stores saves, ROMs, Camps and settings end to end', async () => {
    const fake = createFakeDropbox(2)
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    let now = new Date(2026, 9, 1, 12)
    const provider = new FileStoreProvider(store, {
      id: 'dropbox',
      label: 'Dropbox',
      now: () => now,
    })
    const game = 'emerald' as never

    await provider.putSave(game, new Uint8Array([1]))
    now = new Date(2026, 9, 2, 12)
    await provider.putSave(game, new Uint8Array([2]))
    expect(await provider.listSaveDays(game)).toEqual([
      '2026-10-01',
      '2026-10-02',
    ])
    expect([...(await provider.getSave(game))!.bytes]).toEqual([2])
    expect([...(await provider.getPreviousSave(game))!]).toEqual([1])

    await provider.putRom(game, {
      bytes: new Uint8Array([9]),
      extension: 'gba',
    })
    expect((await provider.getRom(game))!.extension).toBe('gba')

    await provider.saveSettings({ spriteSourceId: 'x', themeId: 'night' })
    expect(await provider.getSettings()).toEqual({
      spriteSourceId: 'x',
      themeId: 'night',
    })

    const camp = await provider.getCamp(3)
    camp.sites[0][0] = {
      id: 'abc',
      fileName: 'é.pk3',
      bytes: new Uint8Array([5, 6]),
      importedAt: '2026-10-02T00:00:00Z',
    }
    await provider.saveCamp(3, camp)
    const loaded = await provider.getCamp(3)
    expect([...loaded.sites[0][0]!.bytes]).toEqual([5, 6])
    expect(fake.files.has('/camp/gen-3/abc.pk3')).toBe(true)

    await provider.discardSave(game)
    expect(await provider.getSave(game)).toBeNull()
    expect(await provider.getRom(game)).not.toBeNull()
  })
})

describe('prefetching through the cache', () => {
  it('serves a Camp Zone load without further Dropbox requests', async () => {
    const fake = createFakeDropbox()
    let now = new Date('2026-10-01T12:00:00')
    const seed = new FileStoreProvider(
      new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep }),
      { id: 'dropbox', label: 'Dropbox', now: () => now }
    )
    await seed.putSave('ruby', new Uint8Array([1]))
    now = new Date('2026-10-03T12:00:00')
    await seed.putSave('ruby', new Uint8Array([2]))
    await seed.putRom('ruby', { bytes: new Uint8Array([9]), extension: 'gba' })
    const camp = await seed.getCamp(3)
    camp.sites[0][4] = {
      id: 'abc',
      fileName: 'abc.pk3',
      bytes: new Uint8Array([7]),
      importedAt: '',
    }
    await seed.saveCamp(3, camp)
    await seed.saveSettings({ spriteSourceId: 'home', themeId: null })

    const provider = new FileStoreProvider(
      new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep }),
      { id: 'dropbox', label: 'Dropbox' }
    )
    fake.requests.length = 0
    await provider.prefetch()
    const downloads = fake.requests
      .filter((request) => request.url.endsWith('/download'))
      .map(
        (request) => JSON.parse(request.headers.get('Dropbox-API-Arg')!).path
      )
      .sort()
    expect(downloads).toEqual([
      '/camp/gen-3/abc.pk3',
      '/camp/gen-3/camp.json',
      '/saves/ruby/2026-10-03/current.sav',
      '/saves/ruby/2026-10-03/previous.sav',
      '/settings.json',
    ])

    fake.requests.length = 0
    expect((await provider.getSave('ruby'))?.bytes).toEqual(new Uint8Array([2]))
    expect(await provider.getPreviousSave('ruby')).toEqual(new Uint8Array([1]))
    expect(await provider.getSave('emerald')).toBeNull()
    expect((await provider.getCamp(3)).sites[0][4]?.id).toBe('abc')
    expect((await provider.getCamp(4)).sites).toHaveLength(10)
    expect(await provider.getSettings()).toEqual({
      spriteSourceId: 'home',
      themeId: null,
    })
    expect(fake.requests).toEqual([])
  })
})

describe('DropboxFileStore cache', () => {
  const endpoint = (url: string) =>
    new URL(url).pathname.replace('/2/files/', '')
  const calls = (fake: ReturnType<typeof createFakeDropbox>, name: string) =>
    fake.requests.filter((request) => endpoint(request.url) === name).length

  async function seeded(files: Record<string, number>) {
    const fake = createFakeDropbox()
    const seed = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    for (const [path, value] of Object.entries(files)) {
      await seed.write(path, new Uint8Array([value]))
    }
    fake.requests.length = 0
    const store = new DropboxFileStore(tokens(), { fetch: fake.fetch, sleep })
    return { fake, store }
  }

  it('downloads each file once, sharing reads in flight', async () => {
    const { fake, store } = await seeded({ 'a.txt': 1 })

    const [first, second] = await Promise.all([
      store.read('a.txt'),
      store.read('a.txt'),
    ])
    await store.read('a.txt')

    expect(first?.bytes).toEqual(new Uint8Array([1]))
    expect(second?.bytes).toEqual(new Uint8Array([1]))
    expect(calls(fake, 'download')).toBe(1)
  })

  it('returns copies, so callers cannot change cached bytes', async () => {
    const { store } = await seeded({ 'a.txt': 1 })

    const file = await store.read('a.txt')
    file!.bytes[0] = 9

    expect((await store.read('a.txt'))?.bytes).toEqual(new Uint8Array([1]))
  })

  it('does not cache a failed download', async () => {
    const { fake } = await seeded({ 'a.txt': 1 })
    let failNext = true
    const flaky = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (failNext) {
        failNext = false
        throw new TypeError('offline')
      }
      return fake.fetch(input, init)
    }) as typeof fetch
    const store = new DropboxFileStore(tokens(), { fetch: flaky, sleep })

    await expect(store.read('a.txt')).rejects.toBeInstanceOf(
      StorageUnavailableError
    )
    expect((await store.read('a.txt'))?.bytes).toEqual(new Uint8Array([1]))
  })

  it('serves its own writes without downloading them', async () => {
    const { fake, store } = await seeded({})
    const modified = new Date('2026-10-03T12:00:00.250Z')

    await store.write('a.txt', new Uint8Array([2]), modified)

    expect(await store.read('a.txt')).toEqual({
      bytes: new Uint8Array([2]),
      // Dropbox keeps whole seconds, and so does the cache.
      modified: new Date('2026-10-03T12:00:00Z'),
    })
    expect(calls(fake, 'download')).toBe(0)
  })

  it('forgets deleted files, including files inside a deleted folder', async () => {
    const { store } = await seeded({
      'saves/ruby/2026-10-01/current.sav': 1,
      'saves/ruby/2026-10-02/current.sav': 2,
    })
    await store.read('saves/ruby/2026-10-01/current.sav')

    await store.delete('saves/ruby/2026-10-01')

    expect(await store.read('saves/ruby/2026-10-01/current.sav')).toBeNull()
  })

  it('answers listings and missing reads from memory after prefetch', async () => {
    const { fake, store } = await seeded({
      'settings.json': 1,
      'saves/ruby/2026-10-01/current.sav': 2,
    })

    await store.prefetch(() => [])
    fake.requests.length = 0
    expect(await store.list('saves/ruby')).toEqual([
      { name: '2026-10-01', kind: 'folder' },
    ])
    expect(await store.read('saves/emerald/2026-10-01/current.sav')).toBeNull()

    expect(fake.requests).toEqual([])
  })

  it('keeps listings current after writes and deletes', async () => {
    const { store } = await seeded({ 'camp/gen-3/a.pk3': 1 })
    await store.prefetch(() => [])

    await store.write('camp/gen-3/b.pk3', new Uint8Array([2]))
    await store.delete('camp/gen-3/a.pk3')

    expect(await store.list('camp/gen-3')).toEqual([
      { name: 'b.pk3', kind: 'file' },
    ])
  })

  it('keeps writes made while the listing was loading', async () => {
    const { fake } = await seeded({})
    let releaseListing!: () => void
    const listingGate = new Promise<void>(
      (resolve) => (releaseListing = resolve)
    )
    const gated = (async (input: RequestInfo | URL, init?: RequestInit) => {
      // Take the listing snapshot now, but answer only once released.
      const response = await fake.fetch(input, init)
      if (String(input).endsWith('/list_folder')) await listingGate
      return response
    }) as typeof fetch
    const store = new DropboxFileStore(tokens(), { fetch: gated, sleep })

    const prefetching = store.prefetch(() => [])
    await new Promise((resolve) => setTimeout(resolve, 0))
    await store.write('settings.json', new Uint8Array([1]))
    releaseListing()
    await prefetching

    expect(await store.list('')).toEqual([
      { name: 'settings.json', kind: 'file' },
    ])
  })

  it('prefetches only the selected paths', async () => {
    const { fake, store } = await seeded({
      'settings.json': 1,
      'saves/ruby/ruby.gba': 2,
    })

    await store.prefetch((paths) => paths.filter((p) => p.endsWith('.json')))
    await store.read('settings.json')

    expect(calls(fake, 'download')).toBe(1)
  })
})
