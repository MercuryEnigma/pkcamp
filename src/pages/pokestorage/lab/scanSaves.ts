import type { PokemonSaveAdapter } from '../../../services/pkhex'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type { StorageProvider, StoredSave } from '../../../services/storage'
import { storageErrorMessage } from '../useStorage'
import type { CabinScanStatus, ScannedPokemon } from './collectionTypes'

/**
 * Reads the party and boxes of each Cabin's stored save. A Cabin that fails
 * is reported and skipped so the others still scan. Stored `.sav` files only:
 * Camp Sites, unsaved Camp changes, and connected devices are not included.
 */
export async function scanSaves(
  provider: StorageProvider,
  adapter: PokemonSaveAdapter,
  gameIds: readonly Gen3GameId[],
  savedFiles?: Partial<Record<Gen3GameId, StoredSave | null>>
): Promise<{ pokemon: ScannedPokemon[]; cabins: CabinScanStatus[] }> {
  const pokemon: ScannedPokemon[] = []
  const cabins: CabinScanStatus[] = []

  for (const gameId of gameIds) {
    try {
      const save = savedFiles
        ? savedFiles[gameId]
        : await provider.getSave(gameId)
      if (!save) {
        cabins.push({ gameId, state: 'empty' })
        continue
      }
      const found: ScannedPokemon[] = []
      const game = adapter.load(save.bytes)
      try {
        for (const node of game.party) {
          if (node) found.push({ node, source: { gameId, location: 'party' } })
        }
        game.boxes.forEach((box, boxIndex) => {
          box.slots.forEach((node, slot) => {
            if (!node) return
            found.push({
              node,
              source: {
                gameId,
                location: { box: boxIndex, slot },
                boxName: box.name,
              },
            })
          })
        })
      } finally {
        game.dispose()
      }
      pokemon.push(...found)
      cabins.push({
        gameId,
        state: 'ok',
        updatedAt: save.updatedAt,
        count: found.length,
      })
    } catch (cause) {
      cabins.push({
        gameId,
        state: 'error',
        message: storageErrorMessage(cause),
      })
    }
  }
  return { pokemon, cabins }
}
