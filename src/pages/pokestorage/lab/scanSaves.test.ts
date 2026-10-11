import { describe, expect, it, vi } from 'vitest'
import {
  createMockPokemonSaveBackend,
  encodeFixtureSaveBytes,
  initializePokemonSaveAdapter,
  type PokemonSaveAdapter,
  type SaveGame,
} from '../../../services/pkhex'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider } from '../../../services/storage'
import { scanSaves } from './scanSaves'

const updatedAt = new Date('2026-10-01T10:00:00Z')

function fakeProvider(
  saves: Partial<Record<Gen3GameId, Uint8Array | Error>>
): StorageProvider {
  return {
    getSave: async (gameId: Gen3GameId) => {
      const save = saves[gameId]
      if (save instanceof Error) throw save
      return save ? { bytes: save, updatedAt } : null
    },
  } as unknown as StorageProvider
}

function trackedAdapter() {
  const adapter = initializePokemonSaveAdapter({
    backend: createMockPokemonSaveBackend(),
  })
  const games: SaveGame[] = []
  const wrapped: PokemonSaveAdapter = {
    ...adapter,
    load(bytes) {
      const game = adapter.load(bytes)
      vi.spyOn(game, 'dispose')
      games.push(game)
      return game
    },
  }
  return { adapter: wrapped, games }
}

describe('scanSaves', () => {
  it('reports ok, empty, and error Cabins and scans the rest', async () => {
    const { adapter, games } = trackedAdapter()
    const provider = fakeProvider({
      emerald: encodeFixtureSaveBytes('fixture:emerald'),
      ruby: new Error('Dropbox is offline'),
      sapphire: new TextEncoder().encode('garbage'),
      // firered has no save
    })

    const { pokemon, cabins } = await scanSaves(provider, adapter, [
      'ruby',
      'sapphire',
      'emerald',
      'firered',
    ])

    expect(cabins[0]).toEqual({
      gameId: 'ruby',
      state: 'error',
      message: 'Dropbox is offline',
    })
    expect(cabins[1].state).toBe('error')
    expect(cabins[2]).toEqual({
      gameId: 'emerald',
      state: 'ok',
      updatedAt,
      count: 3,
    })
    expect(cabins[3]).toEqual({ gameId: 'firered', state: 'empty' })

    // Party Pikachu, then the Eevee and the egg from box 1.
    expect(pokemon.map((p) => p.node.species)).toEqual([25, 133, 175])
    expect(pokemon[0].source).toEqual({ gameId: 'emerald', location: 'party' })
    expect(pokemon[1].source).toEqual({
      gameId: 'emerald',
      location: { box: 0, slot: 0 },
      boxName: 'BOX 1',
    })
    expect(pokemon[2].source.location).toEqual({ box: 0, slot: 2 })

    expect(games).toHaveLength(1)
    expect(games[0].dispose).toHaveBeenCalledTimes(1)
  })

  it('disposes a save even when reading it throws', async () => {
    const { adapter, games } = trackedAdapter()
    const provider = fakeProvider({
      emerald: encodeFixtureSaveBytes('fixture:emerald'),
      ruby: encodeFixtureSaveBytes('fixture:emerald'),
    })
    const load = adapter.load.bind(adapter)
    let calls = 0
    adapter.load = (bytes) => {
      const game = load(bytes)
      if (++calls === 1) {
        Object.defineProperty(game, 'boxes', {
          get() {
            throw new Error('corrupt box data')
          },
        })
      }
      return game
    }

    const { pokemon, cabins } = await scanSaves(provider, adapter, [
      'ruby',
      'emerald',
    ])

    expect(cabins[0]).toEqual({
      gameId: 'ruby',
      state: 'error',
      message: 'corrupt box data',
    })
    expect(cabins[1].state).toBe('ok')
    // The failed Cabin contributes nothing, not a partial list.
    expect(pokemon.every((p) => p.source.gameId === 'emerald')).toBe(true)
    expect(games).toHaveLength(2)
    for (const game of games) expect(game.dispose).toHaveBeenCalledTimes(1)
  })
})
