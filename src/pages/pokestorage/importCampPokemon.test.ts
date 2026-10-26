import { describe, expect, it, vi } from 'vitest'
import type { PokemonSaveAdapter } from '../../services/pkhex'
import type { Camp, CampPokemon } from '../../services/storage'
import { importCampPokemon } from './importCampPokemon'

const bytes = new Uint8Array(80).fill(7)
const camper: CampPokemon = {
  id: 'existing',
  bytes,
  fileName: 'existing.pk3',
  importedAt: '',
}
const emptySite = () => Array<CampPokemon | null>(30).fill(null)
const adapter = {
  importPokemonFile: vi.fn(() => ({ species: 25 })),
} as unknown as PokemonSaveAdapter
function provider(camp: Camp) {
  return { getCamp: vi.fn(async () => camp), saveCamp: vi.fn(async () => {}) }
}

describe('Camp Pokémon import', () => {
  it('uses the first open spot, preserves every camper, and saves immediately', async () => {
    const sites = [emptySite(), emptySite()]
    sites[0].fill(camper)
    sites[1][0] = camper
    sites[1][2] = camper
    const storage = provider({ sites })
    const result = await importCampPokemon(
      storage,
      adapter,
      'pikachu.pk3',
      bytes
    )
    expect(result.position).toEqual({ site: 1, index: 1 })
    expect(storage.saveCamp).toHaveBeenCalledWith(3, result.camp)
    expect(result.camp.sites[0]).toEqual(sites[0])
    expect(result.camp.sites[1][0]).toBe(camper)
    expect(result.camp.sites[1][2]).toBe(camper)
    expect(result.camp.sites[1][1]).toMatchObject({
      fileName: 'pikachu.pk3',
      bytes,
    })
    expect(result.camp.sites[1][1]!.bytes).not.toBe(bytes)
    expect(sites[1][1]).toBeNull()
  })

  it('leaves a full Camp intact instead of overwriting a Pokémon', async () => {
    const storage = provider({ sites: [Array(30).fill(camper)] })
    await expect(
      importCampPokemon(storage, adapter, 'pikachu.pk3', bytes)
    ).rejects.toThrow('Camp is full')
    expect(storage.saveCamp).not.toHaveBeenCalled()
  })

  it.each([
    ['save.sav', 80],
    ['pokemon.pk4', 136],
    ['bad.pk3', 79],
    ['bad.pk3', 101],
  ])('rejects %s of size %i', async (name, size) => {
    const storage = provider({ sites: [emptySite()] })
    await expect(
      importCampPokemon(storage, adapter, name, new Uint8Array(size))
    ).rejects.toThrow('valid .pk3')
    expect(storage.saveCamp).not.toHaveBeenCalled()
  })

  it('does not save an unreadable Pokémon', async () => {
    const storage = provider({ sites: [emptySite()] })
    const broken = {
      importPokemonFile: () => {
        throw new Error('Unreadable PK3')
      },
    } as unknown as PokemonSaveAdapter
    await expect(
      importCampPokemon(storage, broken, 'bad.pk3', bytes)
    ).rejects.toThrow('Unreadable PK3')
    expect(storage.saveCamp).not.toHaveBeenCalled()
  })
})
