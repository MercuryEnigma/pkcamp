import type { SaveGame } from '../../services/pkhex'
import type { Gen3GameId } from '../../services/saveLibrary'
import { GAME_LABEL } from './gameDisplay'

const EXPECTED_VERSION: Readonly<
  Record<Gen3GameId, SaveGame['version']['exact']>
> = {
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
  firered: 'FireRed',
  leafgreen: 'LeafGreen',
}

/** Refuses a valid save that belongs to a different GBA Lodge Cabin. */
export function assertSaveMatchesCabin(
  gameId: Gen3GameId,
  save: Pick<SaveGame, 'version'>
): void {
  const expected = EXPECTED_VERSION[gameId]
  if (save.version.exact !== expected) {
    throw new Error(
      `This is a ${save.version.aggregated} save, not a ${GAME_LABEL[gameId]} save.`
    )
  }
}

/** The Gen 3 game a save belongs to, or null when it is not one of them. */
export function gameIdFromSave(
  save: Pick<SaveGame, 'version'>
): Gen3GameId | null {
  const entry = Object.entries(EXPECTED_VERSION).find(
    ([, version]) => version === save.version.exact
  )
  return entry ? (entry[0] as Gen3GameId) : null
}
