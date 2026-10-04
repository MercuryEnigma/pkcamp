import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Camp, CampPokemon } from '../storage'
import type { PokemonSaveAdapter } from '../pkhex'

const camp: Camp = { sites: [] }
const storageMock = {
  getSave: vi.fn(async (): Promise<{ bytes: Uint8Array } | null> => ({
    bytes: new Uint8Array([0]),
  })),
  putSave: vi.fn(async () => {}),
  getCamp: vi.fn(async () => camp),
  saveCamp: vi.fn(async () => {}),
}

vi.mock('../storage', () => ({ storage: storageMock }))

const { CampSiteTradeDevice, SaveBackupTradeDevice } =
  await import('./localTradeDevice.ts')

const bytes = (value: number) => new Uint8Array([value])

function file(id: string, value: number): CampPokemon {
  return {
    id,
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
  camp.sites = [[null, file('a', 1), file('b', 2)], [file('c', 3)]]
  storageMock.putSave.mockClear()
  storageMock.saveCamp.mockClear()
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
    expect(storageMock.putSave).toHaveBeenCalledWith('ruby', bytes(42))
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
  const slot = { site: 0, index: 1 }

  it('writes the received Pokémon over the expected position', async () => {
    await new CampSiteTradeDevice().write(adapter, slot, bytes(1), bytes(9))
    expect(camp.sites[0][1]).toMatchObject({
      id: 'a',
      bytes: bytes(9),
      fileName: 'ribbondol.pk3',
    })
    expect(storageMock.saveCamp).toHaveBeenCalledWith(3, camp)
  })

  it('rejects a position that changed since it was selected', async () => {
    await expect(
      new CampSiteTradeDevice().write(adapter, slot, bytes(3), bytes(9))
    ).rejects.toThrow('changed')
    expect(storageMock.saveCamp).not.toHaveBeenCalled()
  })

  it('rejects an empty position', async () => {
    await expect(
      new CampSiteTradeDevice().write(
        adapter,
        { site: 0, index: 0 },
        bytes(1),
        bytes(9)
      )
    ).rejects.toThrow('empty')
  })

  it('uses the first other occupied position as the companion', async () => {
    expect(
      await new CampSiteTradeDevice().companion(adapter, slot, bytes(1))
    ).toEqual(bytes(2))
  })
})
