import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PokemonNode, PokemonSaveAdapter, SaveGame } from '../pkhex'
import {
  emptyCamp,
  FileStoreProvider,
  MemoryFileStore,
  type StorageProvider,
} from '../storage'
import { ActiveGameService } from '../activeGame'
import type { CollectionDefinition } from '../../pages/pokestorage/lab/collectionTypes'
import { CollectionsService } from './index'

const ZERO = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
}

function node(species: number): PokemonNode {
  return {
    species,
    form: 0,
    level: 10,
    gender: 'Male',
    shiny: false,
    isEgg: false,
    nickname: `MON${species}`,
    originalTrainerName: 'RED',
    originalTrainerId: 12345,
    originalTrainerSecretId: 54321,
    heldItem: 0,
    heldItemName: '',
    nature: { id: 0, name: 'Hardy' },
    ability: null,
    moves: [null, null, null, null],
    ribbons: [],
    ivs: ZERO,
    evs: ZERO,
    stats: ZERO,
  }
}

function game(bytes: Uint8Array): SaveGame {
  const ruby = bytes[0] === 2
  const species = bytes[0] === 4 ? null : ruby ? 133 : 25
  return {
    trainer: { name: 'RED', id: 1, secretId: 2 },
    party: [],
    boxes: [{ name: 'BOX 1', slots: [species ? node(species) : null] }],
    version: {
      exact: ruby ? 'Ruby' : 'Emerald',
      approximateGeneration: 3,
      aggregated: ruby ? 'Ruby' : 'Emerald',
    },
    movePokemon: vi.fn(),
    movePokemonGroup: vi.fn(),
    setBoxSlot: vi.fn(),
    toBytes: () => bytes,
    dispose: vi.fn(),
  }
}

const adapter: PokemonSaveAdapter = {
  load: (bytes) => game(bytes),
  importPokemonFile: (bytes) => {
    if (bytes.length === 0) throw new Error('Unreadable Pokémon')
    return node(bytes[0])
  },
  exportPokemonFile: (pokemon) => new Uint8Array([pokemon.species]),
  placeInParty: (party) => party,
  placeInBox: (box) => box,
}

const definition: CollectionDefinition = {
  schemaVersion: '1',
  id: 'service-test',
  name: 'Service Test',
  metadata: { version: '1' },
  groups: [],
  pokemon: {
    pikachu: { species: 25 },
    eevee: { species: 133 },
    mew: { species: 151 },
  },
}

function provider(): StorageProvider {
  return new FileStoreProvider(new MemoryFileStore(), {
    id: 'local',
    label: 'Test',
  })
}

const services: CollectionsService[] = []
afterEach(() => {
  for (const service of services.splice(0)) service.dispose()
})

async function setup(withCamp = false) {
  const storage = provider()
  await storage.putLabCollection(definition.id, definition)
  await storage.putSave('emerald', new Uint8Array([1]))
  if (withCamp) {
    const camp = emptyCamp()
    camp.sites[0][0] = {
      id: 'mew',
      fileName: 'mew.pk3',
      bytes: new Uint8Array([151]),
      importedAt: '2026-10-20T00:00:00.000Z',
    }
    await storage.saveCamp(3, camp)
  }
  const active = new ActiveGameService()
  const service = new CollectionsService(active)
  services.push(service)
  await active.select('emerald', storage, adapter)
  await service.initialize()
  return { storage, active, service }
}

describe('CollectionsService incremental scans', () => {
  it('uses the active committed save and Camp without refetching every game', async () => {
    const storage = provider()
    await storage.putLabCollection(definition.id, definition)
    await storage.putSave('emerald', new Uint8Array([1]))
    const getSave = vi.spyOn(storage, 'getSave')
    const active = new ActiveGameService()
    const service = new CollectionsService(active)
    services.push(service)

    await active.select('emerald', storage, adapter)
    await service.initialize()

    expect(getSave).toHaveBeenCalledTimes(1)
    expect(getSave).toHaveBeenCalledWith('emerald')
    expect(service.getSnapshot().results[definition.id]).toMatchObject({
      version: 2,
      owned: 1,
      entries: {
        pikachu: {
          status: 'owned',
          matches: [
            expect.objectContaining({
              originalTrainerName: 'RED',
              originalTrainerId: 12345,
            }),
          ],
        },
      },
    })
  })

  it('preserves other-game matches while replacing only a changed source', async () => {
    const { active, service } = await setup()
    await active.writeSecondarySave('ruby', new Uint8Array([2]))
    await service.refresh()
    let result = service.getSnapshot().results[definition.id]!
    expect(result.entries.pikachu.matches[0]).toMatchObject({
      gameId: 'emerald',
    })
    expect(result.entries.eevee.matches[0]).toMatchObject({ gameId: 'ruby' })

    await active.replaceSave(new Uint8Array([4]))
    await service.refresh()
    result = service.getSnapshot().results[definition.id]!
    expect(result.entries.pikachu.status).toBe('seen')
    expect(result.entries.eevee).toMatchObject({
      status: 'owned',
      matches: [expect.objectContaining({ gameId: 'ruby' })],
    })

    await active.discardSecondarySave('ruby')
    await service.refresh()
    result = service.getSnapshot().results[definition.id]!
    expect(result.entries.eevee).toMatchObject({ status: 'seen', matches: [] })
  })

  it('scans only Camp Sites in the explicit no-game state', async () => {
    const storage = provider()
    await storage.putLabCollection(definition.id, definition)
    const camp = emptyCamp()
    camp.sites[0][0] = {
      id: 'mew',
      fileName: 'mew.pk3',
      bytes: new Uint8Array([151]),
      importedAt: '2026-10-20T00:00:00.000Z',
    }
    await storage.saveCamp(3, camp)
    const getSave = vi.spyOn(storage, 'getSave')
    const active = new ActiveGameService()
    const service = new CollectionsService(active)
    services.push(service)

    await active.select(null, storage, adapter)
    await service.initialize()

    expect(getSave).not.toHaveBeenCalled()
    expect(
      service.getSnapshot().results[definition.id]?.entries.mew
    ).toMatchObject({
      status: 'owned',
      matches: [expect.objectContaining({ camp: true })],
    })
  })

  it('retains matches at unreadable Camp positions', async () => {
    const { active, service } = await setup(true)
    const first = service.getSnapshot().results[definition.id]!
    expect(first.entries.mew.status).toBe('owned')
    const camp = emptyCamp()
    camp.sites[0][0] = {
      id: 'mew',
      fileName: 'mew.pk3',
      bytes: new Uint8Array([]),
      importedAt: '2026-10-20T00:00:00.000Z',
    }

    await active.replaceCamp(camp)
    await service.refresh()

    expect(
      service.getSnapshot().results[definition.id]?.entries.mew
    ).toMatchObject({
      status: 'owned',
      matches: [expect.objectContaining({ camp: true })],
    })
  })
})

describe('CollectionsService session state', () => {
  it('tracks enabled collections, recency, aggregate progress, and workspace state', async () => {
    const { service } = await setup()
    const builtInId = service
      .getSnapshot()
      .definitions.find((item) => item.id !== definition.id)!.id
    service.setEnabled([definition.id, builtInId])
    service.openCollection(builtInId)
    service.openCollection(definition.id)
    service.updateWorkspace(definition.id, {
      selectedEntryId: 'pikachu',
      query: 'pika',
      filter: 'registered',
      scrollTop: 240,
    })

    const snapshot = service.getSnapshot()
    expect(snapshot.recentIds.slice(0, 2)).toEqual([definition.id, builtInId])
    expect(snapshot.overflowIds).toEqual([])
    expect(snapshot.workspaces[definition.id]).toMatchObject({
      selectedEntryId: 'pikachu',
      query: 'pika',
      filter: 'registered',
      scrollTop: 240,
    })
    const expected = [definition.id, builtInId].reduce(
      (sum, id) => {
        const result = snapshot.results[id]!
        return {
          registered: sum.registered + result.owned + result.seen,
          total: sum.total + result.total,
        }
      },
      { registered: 0, total: 0 }
    )
    expect({ registered: snapshot.registered, total: snapshot.total }).toEqual(
      expected
    )

    service.setEnabled([builtInId])
    expect(service.getSnapshot().currentId).toBe(builtInId)
    expect(() => service.setEnabled([])).toThrow(/At least one/)
  })

  it('clears provider-scoped PC session state on an account change', async () => {
    const { active, service } = await setup()
    const builtInId = service
      .getSnapshot()
      .definitions.find((item) => item.id !== definition.id)!.id
    service.setEnabled([definition.id])
    service.updateWorkspace(definition.id, { query: 'remember me' })

    const next = provider()
    await next.putLabCollection(definition.id, definition)
    await next.putSave('emerald', new Uint8Array([1]))
    await active.select('emerald', next, adapter)
    await service.initialize()

    const snapshot = service.getSnapshot()
    expect(snapshot.provider).toBe(next)
    expect(snapshot.enabledIds).toContain(builtInId)
    expect(snapshot.workspaces).toEqual({})
  })
})
