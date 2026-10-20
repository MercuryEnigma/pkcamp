import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryFileStore } from './fileStore'
import {
  dayOf,
  emptyCamp,
  FileStoreProvider,
  prefetchPaths,
} from './fileStoreProvider'
import {
  CAMP_SITE_SIZE,
  DEFAULT_CAMP_SITE_COUNT,
  type Camp,
  type CampPokemon,
  type StoredCollectionResult,
} from './types'

const bytes = (...values: number[]) => new Uint8Array(values)
const arr = (value: Uint8Array | null | undefined) =>
  value ? Array.from(value) : value

let clock: Date
let store: MemoryFileStore
let provider: FileStoreProvider

const at = (month: number, day: number, hour = 12) =>
  new Date(2026, month - 1, day, hour)

beforeEach(() => {
  clock = at(1, 5)
  store = new MemoryFileStore()
  provider = new FileStoreProvider(store, {
    id: 'local',
    label: 'Test',
    now: () => clock,
  })
})

describe('dayOf', () => {
  it('uses the local calendar day, zero padded', () => {
    expect(dayOf(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(dayOf(new Date(2026, 10, 15, 0, 0))).toBe('2026-11-15')
  })
})

describe('saves', () => {
  it('has nothing initially', async () => {
    expect(await provider.getSave('ruby')).toBeNull()
    expect(await provider.getPreviousSave('ruby')).toBeNull()
    expect(await provider.listSaveDays('ruby')).toEqual([])
  })

  it('first save creates the day with no previous', async () => {
    await provider.putSave('ruby', bytes(1))
    const save = await provider.getSave('ruby')
    expect(arr(save!.bytes)).toEqual([1])
    expect(save!.updatedAt).toEqual(clock)
    expect(await provider.getPreviousSave('ruby')).toBeNull()
    expect(await provider.listSaveDays('ruby')).toEqual(['2026-01-05'])
  })

  it('later saves the same day overwrite only current', async () => {
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 5, 18)
    await provider.putSave('ruby', bytes(2))
    clock = at(1, 5, 20)
    await provider.putSave('ruby', bytes(3))
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([3])
    expect(await provider.getPreviousSave('ruby')).toBeNull()
    expect(await provider.listSaveDays('ruby')).toEqual(['2026-01-05'])
  })

  it('next day copies the prior current into previous', async () => {
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 5, 20)
    await provider.putSave('ruby', bytes(2))
    clock = at(1, 6)
    await provider.putSave('ruby', bytes(3))
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([3])
    expect(arr(await provider.getPreviousSave('ruby'))).toEqual([2])
    expect(await provider.listSaveDays('ruby')).toEqual([
      '2026-01-05',
      '2026-01-06',
    ])
    // The older day is untouched.
    expect(
      arr((await store.read('saves/ruby/2026-01-05/current.sav'))!.bytes)
    ).toEqual([2])
  })

  it('a second save on the new day keeps the same previous', async () => {
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 6)
    await provider.putSave('ruby', bytes(2))
    clock = at(1, 6, 22)
    await provider.putSave('ruby', bytes(3))
    expect(arr(await provider.getPreviousSave('ruby'))).toEqual([1])
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([3])
  })

  it('a gap of several days creates no folders for idle days', async () => {
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 12)
    await provider.putSave('ruby', bytes(2))
    expect(await provider.listSaveDays('ruby')).toEqual([
      '2026-01-05',
      '2026-01-12',
    ])
    expect(arr(await provider.getPreviousSave('ruby'))).toEqual([1])
  })

  it('previous keeps the earlier save modified time', async () => {
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 6)
    await provider.putSave('ruby', bytes(2))
    const previous = await store.read('saves/ruby/2026-01-06/previous.sav')
    expect(previous!.modified).toEqual(at(1, 5))
  })

  it('a clock moved backwards keeps writing the newest day', async () => {
    clock = at(1, 10)
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 3)
    await provider.putSave('ruby', bytes(2))
    expect(await provider.listSaveDays('ruby')).toEqual(['2026-01-10'])
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([2])
    expect(await provider.getPreviousSave('ruby')).toBeNull()
  })

  it('getSave skips a newest day folder without current.sav', async () => {
    await provider.putSave('ruby', bytes(1))
    await store.write('saves/ruby/2026-01-09/previous.sav', bytes(7))
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([1])
    // A previous.sav left in a day without a current.sav (an interrupted
    // save) is not the previous save of the current one.
    expect(await provider.getPreviousSave('ruby')).toBeNull()
  })

  it('putSave after a current-less newest day copies the latest real save', async () => {
    await provider.putSave('ruby', bytes(1))
    await store.write('saves/ruby/2026-01-09/previous.sav', bytes(7))
    clock = at(1, 9)
    await provider.putSave('ruby', bytes(2))
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([2])
  })

  it('ignores non-day folders and does not mix up similar game ids', async () => {
    await provider.putSave('ruby', bytes(1))
    await store.write('saves/ruby/notes/current.sav', bytes(9))
    await store.write('saves/rubyx/2026-02-01/current.sav', bytes(8))
    expect(await provider.listSaveDays('ruby')).toEqual(['2026-01-05'])
  })

  it('keeps games separate', async () => {
    await provider.putSave('ruby', bytes(1))
    await provider.putSave('emerald', bytes(2))
    expect(arr((await provider.getSave('emerald'))!.bytes)).toEqual([2])
    expect(arr((await provider.getSave('ruby'))!.bytes)).toEqual([1])
  })

  it('discard removes every day but keeps the ROM and other games', async () => {
    await provider.putRom('ruby', { bytes: bytes(5), extension: 'gba' })
    await provider.putSave('ruby', bytes(1))
    clock = at(1, 6)
    await provider.putSave('ruby', bytes(2))
    await provider.putSave('emerald', bytes(3))
    await provider.discardSave('ruby')
    expect(await provider.getSave('ruby')).toBeNull()
    expect(await provider.getPreviousSave('ruby')).toBeNull()
    expect(await provider.listSaveDays('ruby')).toEqual([])
    expect(arr((await provider.getRom('ruby'))!.bytes)).toEqual([5])
    expect(await provider.getSave('emerald')).not.toBeNull()
  })

  it('can save again after discard without a previous', async () => {
    await provider.putSave('ruby', bytes(1))
    await provider.discardSave('ruby')
    await provider.putSave('ruby', bytes(2))
    expect(await provider.getPreviousSave('ruby')).toBeNull()
  })
})

describe('ROMs', () => {
  it('is null when missing', async () => {
    expect(await provider.getRom('ruby')).toBeNull()
    expect(await provider.hasRom('ruby')).toBe(false)
  })

  it('round trips', async () => {
    await provider.putRom('ruby', { bytes: bytes(1, 2), extension: 'gba' })
    const rom = await provider.getRom('ruby')
    expect(arr(rom!.bytes)).toEqual([1, 2])
    expect(rom!.extension).toBe('gba')
    expect(await provider.hasRom('ruby')).toBe(true)
  })

  it('normalizes a leading dot and case', async () => {
    await provider.putRom('ruby', { bytes: bytes(1), extension: '.GBA' })
    expect((await provider.getRom('ruby'))!.extension).toBe('gba')
  })

  it('replaces a ROM with a different extension', async () => {
    await provider.putRom('ruby', { bytes: bytes(1), extension: 'gba' })
    await provider.putRom('ruby', { bytes: bytes(2), extension: 'bin' })
    const rom = await provider.getRom('ruby')
    expect(rom!.extension).toBe('bin')
    expect(arr(rom!.bytes)).toEqual([2])
    expect(await store.read('saves/ruby/ruby.gba')).toBeNull()
  })

  it('replaces a ROM with the same extension', async () => {
    await provider.putRom('ruby', { bytes: bytes(1), extension: 'gba' })
    await provider.putRom('ruby', { bytes: bytes(2), extension: 'gba' })
    expect(arr((await provider.getRom('ruby'))!.bytes)).toEqual([2])
  })

  it('rejects unsafe extensions without writing', async () => {
    for (const extension of ['', '.', 'g/ba', '../x', 'a.b', 'g ba']) {
      await expect(
        provider.putRom('ruby', { bytes: bytes(1), extension })
      ).rejects.toThrow(/extension/)
    }
    expect(await provider.getRom('ruby')).toBeNull()
  })

  it('discard removes only the ROM', async () => {
    await provider.putRom('ruby', { bytes: bytes(1), extension: 'gba' })
    await provider.putSave('ruby', bytes(2))
    await provider.discardRom('ruby')
    expect(await provider.getRom('ruby')).toBeNull()
    expect(await provider.hasRom('ruby')).toBe(false)
    expect(await provider.getSave('ruby')).not.toBeNull()
  })

  it('does not confuse another game id as a ROM', async () => {
    await provider.putRom('ruby', { bytes: bytes(1), extension: 'gba' })
    await store.write('saves/rubyx/rubyx.gba', bytes(9))
    expect((await provider.getRom('ruby'))!.extension).toBe('gba')
  })
})

describe('Camp', () => {
  const mon = (id: string, ...data: number[]): CampPokemon => ({
    id,
    fileName: `${id}.pk3`,
    bytes: bytes(...data),
    importedAt: '2026-01-01T00:00:00.000Z',
  })
  const campOf = (
    placements: [number, number, CampPokemon][],
    siteCount = DEFAULT_CAMP_SITE_COUNT
  ): Camp => {
    const camp = emptyCamp(siteCount)
    for (const [site, index, pokemon] of placements) {
      camp.sites[site][index] = pokemon
    }
    return camp
  }
  const pkFiles = async () =>
    (await store.list('camp/gen-3'))
      .map((entry) => entry.name)
      .filter((name) => name.includes('.pk'))
      .sort()

  it('defaults to empty default-size Camp', async () => {
    const camp = await provider.getCamp(3)
    expect(camp.sites).toHaveLength(DEFAULT_CAMP_SITE_COUNT)
    for (const site of camp.sites) {
      expect(site).toHaveLength(CAMP_SITE_SIZE)
      expect(site.every((slot) => slot === null)).toBe(true)
    }
  })

  it('round trips positions exactly, including gaps', async () => {
    const camp = campOf([
      [0, 0, mon('a', 1)],
      [0, 29, mon('b', 2)],
      [4, 7, mon('c', 3)],
    ])
    await provider.saveCamp(3, camp)
    const loaded = await provider.getCamp(3)
    expect(loaded.sites).toHaveLength(DEFAULT_CAMP_SITE_COUNT)
    expect(loaded.sites[0][0]!.id).toBe('a')
    expect(arr(loaded.sites[0][29]!.bytes)).toEqual([2])
    expect(loaded.sites[4][7]).toMatchObject({
      id: 'c',
      fileName: 'c.pk3',
      importedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(loaded.sites[0][1]).toBeNull()
    expect(loaded.sites[9].every((slot) => slot === null)).toBe(true)
  })

  it('stores a non-default site count', async () => {
    await provider.saveCamp(3, campOf([[2, 1, mon('a', 1)]], 3))
    expect((await provider.getCamp(3)).sites).toHaveLength(3)
    await provider.saveCamp(3, campOf([], 1))
    expect((await provider.getCamp(3)).sites).toHaveLength(1)
  })

  it('keeps generations separate', async () => {
    await provider.saveCamp(3, campOf([[0, 0, mon('a', 1)]]))
    expect((await provider.getCamp(4)).sites[0][0]).toBeNull()
    expect(await store.read('camp/gen-3/a.pk3')).not.toBeNull()
  })

  it('writes only changed Pokémon, manifest last', async () => {
    const camp = campOf([
      [0, 0, mon('a', 1)],
      [0, 1, mon('b', 2)],
    ])
    await provider.saveCamp(3, camp)

    const spy = vi.spyOn(store, 'write')
    await provider.saveCamp(3, camp)
    expect(spy.mock.calls.map(([path]) => path)).toEqual([
      'camp/gen-3/camp.json',
    ])

    spy.mockClear()
    camp.sites[0][1] = mon('b', 9)
    camp.sites[0][2] = mon('c', 3)
    await provider.saveCamp(3, camp)
    expect(spy.mock.calls.map(([path]) => path)).toEqual([
      'camp/gen-3/b.pk3',
      'camp/gen-3/c.pk3',
      'camp/gen-3/camp.json',
    ])
  })

  it('rewrites a Pokémon that keeps its id but gets new bytes', async () => {
    await provider.saveCamp(3, campOf([[0, 0, mon('a', 1)]]))
    await provider.saveCamp(3, campOf([[0, 0, mon('a', 2)]]))
    expect(arr((await provider.getCamp(3)).sites[0][0]!.bytes)).toEqual([2])
    expect(arr((await store.read('camp/gen-3/a.pk3'))!.bytes)).toEqual([2])
  })

  it('moving a Pokémon rewrites no Pokémon file', async () => {
    const a = mon('a', 1)
    await provider.saveCamp(3, campOf([[0, 0, a]]))
    const spy = vi.spyOn(store, 'write')
    await provider.saveCamp(3, campOf([[5, 12, a]]))
    expect(spy.mock.calls.map(([path]) => path)).toEqual([
      'camp/gen-3/camp.json',
    ])
    const loaded = await provider.getCamp(3)
    expect(loaded.sites[0][0]).toBeNull()
    expect(loaded.sites[5][12]!.id).toBe('a')
  })

  it('deletes orphaned files', async () => {
    await provider.saveCamp(
      3,
      campOf([
        [0, 0, mon('a', 1)],
        [0, 1, mon('b', 2)],
      ])
    )
    await provider.saveCamp(3, campOf([[0, 0, mon('a', 1)]]))
    expect(await pkFiles()).toEqual(['a.pk3'])
  })

  it('removing a site drops its Pokémon files', async () => {
    await provider.saveCamp(
      3,
      campOf(
        [
          [0, 0, mon('a', 1)],
          [2, 0, mon('b', 2)],
        ],
        3
      )
    )
    const smaller = campOf([[0, 0, mon('a', 1)]], 2)
    await provider.saveCamp(3, smaller)
    expect((await provider.getCamp(3)).sites).toHaveLength(2)
    expect(await pkFiles()).toEqual(['a.pk3'])
  })

  it('leaves another generation alone when cleaning orphans', async () => {
    await provider.saveCamp(4, campOf([[0, 0, mon('z', 1)]]))
    await provider.saveCamp(3, campOf([[0, 0, mon('a', 1)]]))
    await provider.saveCamp(3, campOf([]))
    expect(await store.read('camp/gen-4/z.pk4')).not.toBeNull()
  })

  it('treats a missing .pk file as an empty space', async () => {
    await provider.saveCamp(
      3,
      campOf([
        [0, 0, mon('a', 1)],
        [0, 1, mon('b', 2)],
      ])
    )
    await store.delete('camp/gen-3/a.pk3')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loaded = await provider.getCamp(3)
    errors.mockRestore()
    expect(loaded.sites[0][0]).toBeNull()
    expect(loaded.sites[0][1]!.id).toBe('b')
  })

  it('rewrites a Pokémon file that went missing while its hash still matches', async () => {
    const camp = campOf([[0, 0, mon('a', 1)]])
    await provider.saveCamp(3, camp)
    await store.delete('camp/gen-3/a.pk3')
    await provider.saveCamp(3, camp)
    expect(arr((await store.read('camp/gen-3/a.pk3'))?.bytes)).toEqual([1])
  })

  it('refuses a manifest whose sites are not whole Camp Sites', async () => {
    const manifest = {
      version: 1,
      sites: [new Array(CAMP_SITE_SIZE - 1).fill(null)],
    }
    await store.write(
      'camp/gen-3/camp.json',
      new TextEncoder().encode(JSON.stringify(manifest))
    )
    await expect(provider.getCamp(3)).rejects.toThrow(/damaged/)
    await expect(provider.saveCamp(3, emptyCamp())).rejects.toThrow(/damaged/)
  })

  it('rejects an unreadable newer manifest version', async () => {
    await store.write(
      'camp/gen-3/camp.json',
      new TextEncoder().encode(JSON.stringify({ version: 99, sites: [] }))
    )
    await expect(provider.getCamp(3)).rejects.toThrow(/newer version/)
    await expect(provider.saveCamp(3, emptyCamp())).rejects.toThrow(
      /newer version/
    )
  })

  describe('validation', () => {
    it('rejects zero sites', async () => {
      await expect(provider.saveCamp(3, { sites: [] })).rejects.toThrow(
        RangeError
      )
    })

    it('rejects a site with the wrong length', async () => {
      const camp = emptyCamp(2)
      camp.sites[1] = new Array(CAMP_SITE_SIZE - 1).fill(null)
      await expect(provider.saveCamp(3, camp)).rejects.toThrow(RangeError)
      camp.sites[1] = new Array(CAMP_SITE_SIZE + 1).fill(null)
      await expect(provider.saveCamp(3, camp)).rejects.toThrow(RangeError)
    })

    it('rejects duplicate ids', async () => {
      await expect(
        provider.saveCamp(
          3,
          campOf([
            [0, 0, mon('a', 1)],
            [1, 0, mon('a', 2)],
          ])
        )
      ).rejects.toThrow(/Duplicate/)
    })

    it('rejects unsafe ids', async () => {
      for (const id of ['', '../x', 'a/b', 'a.b', 'a b', 'camp.json']) {
        await expect(
          provider.saveCamp(3, campOf([[0, 0, mon(id, 1)]]))
        ).rejects.toThrow(/Invalid/)
      }
    })

    it('writes nothing when validation fails', async () => {
      const spy = vi.spyOn(store, 'write')
      await provider
        .saveCamp(3, campOf([[0, 0, mon('../x', 1)]]))
        .catch(() => {})
      expect(spy).not.toHaveBeenCalled()
    })
  })
})

describe('settings', () => {
  it('defaults', async () => {
    expect(await provider.getSettings()).toEqual({ spriteSourceId: null })
  })

  it('round trips', async () => {
    await provider.saveSettings({ spriteSourceId: 'gen5-bw' })
    expect(await provider.getSettings()).toEqual({ spriteSourceId: 'gen5-bw' })
    await provider.saveSettings({ spriteSourceId: null })
    expect(await provider.getSettings()).toEqual({ spriteSourceId: null })
  })

  it('ignores unknown or malformed stored fields', async () => {
    const write = (value: unknown) =>
      store.write(
        'settings.json',
        new TextEncoder().encode(JSON.stringify(value))
      )
    await write({ spriteSourceId: 5, other: true })
    expect(await provider.getSettings()).toEqual({ spriteSourceId: null })
    await write(null)
    expect(await provider.getSettings()).toEqual({ spriteSourceId: null })
    await write({})
    expect(await provider.getSettings()).toEqual({ spriteSourceId: null })
  })
})

describe('prefetchPaths', () => {
  it('picks the newest day per game, Camps, and settings only', () => {
    const paths = [
      'settings.json',
      'saves/ruby/2026-09-30/current.sav',
      'saves/ruby/2026-10-02/current.sav',
      'saves/ruby/2026-10-02/previous.sav',
      'saves/ruby/2026-10-01/current.sav',
      'saves/ruby/ruby.gba',
      'saves/emerald/2026-08-01/current.sav',
      'camp/gen-3/camp.json',
      'camp/gen-3/abc.pk3',
      'pokedex/unown-dex.json',
      'accounts/dropbox.json',
      'migrations/legacy-browser-storage.json',
    ]

    expect(prefetchPaths(paths).sort()).toEqual(
      [
        'camp/gen-3/abc.pk3',
        'camp/gen-3/camp.json',
        'pokedex/unown-dex.json',
        'saves/emerald/2026-08-01/current.sav',
        'saves/ruby/2026-10-02/current.sav',
        'saves/ruby/2026-10-02/previous.sav',
        'settings.json',
      ].sort()
    )
  })
})

describe('hardware backups', () => {
  const bytes = (...values: number[]) => new Uint8Array(values)

  function setup() {
    const store = new MemoryFileStore()
    let now = new Date('2026-10-03T12:00:00')
    const provider = new FileStoreProvider(store, {
      id: 'local',
      label: 'This browser',
      now: () => now,
    })
    return {
      store,
      provider,
      setNow: (value: string) => (now = new Date(value)),
    }
  }

  it('stores hardware.sav in the day folder, apart from current and previous', async () => {
    const { store, provider } = setup()

    await provider.putHardwareSave('ruby', bytes(5))

    expect(
      (await store.read('saves/ruby/2026-10-03/hardware.sav'))?.bytes
    ).toEqual(bytes(5))
    expect(await provider.getSave('ruby')).toBeNull()
    expect(await provider.getPreviousSave('ruby')).toBeNull()
    expect((await provider.getHardwareSave('ruby'))?.bytes).toEqual(bytes(5))
  })

  it('does not count a hardware-only day as the first save of the day', async () => {
    const { provider, setNow } = setup()
    await provider.putSave('ruby', bytes(1))
    setNow('2026-10-04T09:00:00')
    await provider.putHardwareSave('ruby', bytes(9))

    await provider.putSave('ruby', bytes(2))

    expect((await provider.getSave('ruby'))?.bytes).toEqual(bytes(2))
    // The first change of the 4th still keeps the 3rd's save as previous.
    expect(await provider.getPreviousSave('ruby')).toEqual(bytes(1))
  })

  it('ignores a newer hardware-only day when reading the current save', async () => {
    const { provider, setNow } = setup()
    await provider.putSave('ruby', bytes(1))
    setNow('2026-10-05T09:00:00')
    await provider.putHardwareSave('ruby', bytes(9))

    expect((await provider.getSave('ruby'))?.bytes).toEqual(bytes(1))
    expect(await provider.getPreviousSave('ruby')).toBeNull()
  })

  it('replaces a second hardware backup made the same day', async () => {
    const { provider } = setup()
    await provider.putHardwareSave('ruby', bytes(1))
    await provider.putHardwareSave('ruby', bytes(2))

    expect((await provider.getHardwareSave('ruby'))?.bytes).toEqual(bytes(2))
  })

  it('returns the newest hardware backup', async () => {
    const { provider, setNow } = setup()
    await provider.putHardwareSave('ruby', bytes(1))
    setNow('2026-10-06T09:00:00')
    await provider.putHardwareSave('ruby', bytes(2))

    expect((await provider.getHardwareSave('ruby'))?.bytes).toEqual(bytes(2))
    expect(await provider.getHardwareSave('emerald')).toBeNull()
  })

  it('keeps hardware backups when the save is discarded', async () => {
    const { provider } = setup()
    await provider.putSave('ruby', bytes(1))
    await provider.putHardwareSave('ruby', bytes(9))

    await provider.discardSave('ruby')

    expect(await provider.getSave('ruby')).toBeNull()
    expect((await provider.getHardwareSave('ruby'))?.bytes).toEqual(bytes(9))
  })

  it('is not part of what prefetch loads for the newest day', () => {
    expect(
      prefetchPaths([
        'saves/ruby/2026-10-02/current.sav',
        'saves/ruby/2026-10-05/hardware.sav',
      ])
    ).toEqual(['saves/ruby/2026-10-02/current.sav'])
  })
})

describe('collection results', () => {
  const result: StoredCollectionResult = {
    version: 1,
    collectionId: 'unown-dex',
    collectionName: 'Unown Dex',
    collectionVersion: '1.0.0',
    scannedAt: '2026-01-05T12:00:00.000Z',
    sources: [{ gameId: 'emerald', saveUpdatedAt: '2026-01-04T10:00:00.000Z' }],
    owned: 1,
    seen: 0,
    total: 2,
    entries: {
      'unown-a': {
        status: 'owned',
        firstOwnedAt: '2026-01-05T12:00:00.000Z',
        lastOwnedAt: '2026-01-05T12:00:00.000Z',
        matches: [
          {
            gameId: 'emerald',
            location: { box: 0, slot: 3 },
            boxName: 'BOX 1',
            species: 201,
            form: 0,
            nickname: 'UNOWN',
            level: 5,
            shiny: false,
          },
        ],
      },
      'unown-b': { status: 'unseen', matches: [] },
    },
  }

  it('is null before the first scan', async () => {
    expect(await provider.getCollectionResult('unown-dex')).toBeNull()
  })

  it('round trips a result', async () => {
    await provider.putCollectionResult(result)
    expect(await provider.getCollectionResult('unown-dex')).toEqual(result)
    expect(await store.read('pokedex/unown-dex.json')).not.toBeNull()
  })

  it('replaces the previous result', async () => {
    await provider.putCollectionResult(result)
    await provider.putCollectionResult({ ...result, owned: 2 })
    expect((await provider.getCollectionResult('unown-dex'))!.owned).toBe(2)
  })

  it('reads a corrupt or foreign file as missing', async () => {
    const write = (text: string) =>
      store.write('pokedex/unown-dex.json', new TextEncoder().encode(text))
    await write('not json {')
    expect(await provider.getCollectionResult('unown-dex')).toBeNull()
    await write('null')
    expect(await provider.getCollectionResult('unown-dex')).toBeNull()
    await write(JSON.stringify({ ...result, version: 2 }))
    expect(await provider.getCollectionResult('unown-dex')).toBeNull()
    await write(JSON.stringify({ ...result, collectionId: 'other' }))
    expect(await provider.getCollectionResult('unown-dex')).toBeNull()
  })

  it('rejects unsafe collection ids', async () => {
    for (const id of ['../x', 'a b', 'a/b', '']) {
      await expect(provider.getCollectionResult(id)).rejects.toThrow()
      await expect(
        provider.putCollectionResult({ ...result, collectionId: id })
      ).rejects.toThrow()
      await expect(provider.discardCollectionResult(id)).rejects.toThrow()
    }
  })

  it('discards a result, and a missing one is fine', async () => {
    await provider.putCollectionResult(result)
    await provider.discardCollectionResult('unown-dex')
    expect(await provider.getCollectionResult('unown-dex')).toBeNull()
    await expect(
      provider.discardCollectionResult('unown-dex')
    ).resolves.toBeUndefined()
  })
})

describe('Lab data', () => {
  it('defaults to no source choice and round trips one', async () => {
    expect(await provider.getLabSettings()).toEqual({ sources: null })
    await provider.saveLabSettings({ sources: ['emerald', 'camp'] })
    expect(await provider.getLabSettings()).toEqual({
      sources: ['emerald', 'camp'],
    })
    expect(await store.read('lab/settings.json')).not.toBeNull()
  })

  it('reads corrupt or malformed Lab settings as no choice', async () => {
    const write = (text: string) =>
      store.write('lab/settings.json', new TextEncoder().encode(text))
    await write('not json {')
    expect(await provider.getLabSettings()).toEqual({ sources: null })
    await write(JSON.stringify({ sources: ['emerald', 3] }))
    expect(await provider.getLabSettings()).toEqual({ sources: null })
  })

  it('stores, lists, replaces, and discards uploaded collections', async () => {
    expect(await provider.listLabCollections()).toEqual([])
    await provider.putLabCollection('my-dex', { id: 'my-dex', v: 1 })
    await provider.putLabCollection('other-dex', { id: 'other-dex' })
    await provider.putLabCollection('my-dex', { id: 'my-dex', v: 2 })
    expect(await store.read('lab/collections/my-dex.json')).not.toBeNull()
    const listed = (await provider.listLabCollections()) as { id: string }[]
    expect(listed.map((d) => d.id).sort()).toEqual(['my-dex', 'other-dex'])
    expect(listed.find((d) => d.id === 'my-dex')).toEqual({
      id: 'my-dex',
      v: 2,
    })
    await provider.discardLabCollection('my-dex')
    await provider.discardLabCollection('missing')
    expect(await provider.listLabCollections()).toEqual([{ id: 'other-dex' }])
  })

  it('skips collection files that are not JSON', async () => {
    await provider.putLabCollection('good', { id: 'good' })
    await store.write(
      'lab/collections/bad.json',
      new TextEncoder().encode('{ nope')
    )
    expect(await provider.listLabCollections()).toEqual([{ id: 'good' }])
  })

  it('rejects unsafe collection ids', async () => {
    for (const id of ['../x', 'a/b', 'a b', '']) {
      await expect(provider.putLabCollection(id, {})).rejects.toThrow()
      await expect(provider.discardLabCollection(id)).rejects.toThrow()
    }
  })

  it('prefetches Lab settings and uploaded collections', () => {
    expect(
      prefetchPaths([
        'lab/settings.json',
        'lab/collections/my-dex.json',
        'lab/other/thing.json',
      ]).sort()
    ).toEqual(['lab/collections/my-dex.json', 'lab/settings.json'])
  })
})
