import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredPokemonFile } from '../localPokemonLibrary'
import type { PokemonSaveAdapter } from '../pkhex'

const campSlots: (StoredPokemonFile | null)[] = []
const saveLibraryMock = {
  whenReady: vi.fn(async () => {}),
  getSave: vi.fn((): Uint8Array | null => new Uint8Array([0])),
  updateSave: vi.fn(),
}

vi.mock('../localPokemonLibrary', () => ({
  localPokemonLibrary: {
    getSlots: vi.fn(async () => campSlots.slice()),
    saveSlots: vi.fn(async (_generation: number, slots: typeof campSlots) => {
      campSlots.splice(0, campSlots.length, ...slots)
    }),
  },
}))
vi.mock('../saveLibrary', () => ({ saveLibrary: saveLibraryMock }))

const { CampSiteTradeDevice, SaveBackupTradeDevice } =
  await import('./localTradeDevice.ts')

const bytes = (value: number) => new Uint8Array([value])

function file(id: string, value: number): StoredPokemonFile {
  return {
    id,
    slot: 0,
    fileName: `${id}.pk3`,
    bytes: bytes(value),
    importedAt: '',
  }
}

/** A one-box save whose Pokémon are represented by their PK3 byte value. */
function fakeAdapter(boxSlots: (number | null)[]) {
  const setBoxSlot = vi.fn()
  const adapter = {
    load: () => ({
      boxes: [
        { slots: boxSlots.map((value) => (value === null ? null : { value })) },
      ],
      party: [],
      setBoxSlot,
      toBytes: () => bytes(42),
      dispose: () => {},
    }),
    exportPokemonFile: (pokemon: { value: number }) => bytes(pokemon.value),
    importPokemonFile: (pk3: Uint8Array) => ({
      value: pk3[0],
      nickname: 'Ribbondol',
      species: 1,
    }),
  }
  return { adapter: adapter as unknown as PokemonSaveAdapter, setBoxSlot }
}

beforeEach(() => {
  campSlots.splice(0, campSlots.length, null, file('a', 1), file('b', 2))
  saveLibraryMock.updateSave.mockClear()
})

describe('SaveBackupTradeDevice', () => {
  const slot = { gameId: 'ruby' as const, box: 0, index: 1 }

  it('writes the received Pokémon over the expected slot', async () => {
    const { adapter, setBoxSlot } = fakeAdapter([5, 1, null])
    await new SaveBackupTradeDevice().write(adapter, slot, bytes(1), bytes(9))
    expect(setBoxSlot).toHaveBeenCalledWith(
      { box: 0, slot: 1 },
      { value: 9, nickname: 'Ribbondol', species: 1 }
    )
    expect(saveLibraryMock.updateSave).toHaveBeenCalledWith('ruby', bytes(42))
  })

  it('rejects a slot that changed since it was selected', async () => {
    const { adapter, setBoxSlot } = fakeAdapter([5, 3, null])
    await expect(
      new SaveBackupTradeDevice().write(adapter, slot, bytes(1), bytes(9))
    ).rejects.toThrow('changed')
    expect(setBoxSlot).not.toHaveBeenCalled()
  })

  it('uses the first other occupied slot as the companion', async () => {
    const { adapter } = fakeAdapter([null, 1, 7])
    expect(
      await new SaveBackupTradeDevice().companion(adapter, slot, bytes(1))
    ).toEqual(bytes(7))
  })
})

describe('CampSiteTradeDevice', () => {
  const { adapter } = fakeAdapter([])

  it('writes the received Pokémon over the expected file', async () => {
    await new CampSiteTradeDevice().write(
      adapter,
      { id: 'a' },
      bytes(1),
      bytes(9)
    )
    expect(campSlots[1]).toMatchObject({
      id: 'a',
      bytes: bytes(9),
      fileName: 'ribbondol.pk3',
    })
  })

  it('rejects a file that changed since it was selected', async () => {
    await expect(
      new CampSiteTradeDevice().write(adapter, { id: 'a' }, bytes(3), bytes(9))
    ).rejects.toThrow('changed')
    expect(campSlots[1]?.bytes).toEqual(bytes(1))
  })

  it('uses the first other occupied file as the companion', async () => {
    expect(
      await new CampSiteTradeDevice().companion(adapter, { id: 'a' }, bytes(1))
    ).toEqual(bytes(2))
  })
})
