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

/** Ruby and Sapphire saves carry no version byte, so both Cabins take either. */
const RUBY_SAPPHIRE: ReadonlySet<Gen3GameId> = new Set(['ruby', 'sapphire'])

/** Refuses a valid save that belongs to a different GBA Lodge Cabin. */
export function assertSaveMatchesCabin(
  gameId: Gen3GameId,
  save: Pick<SaveGame, 'version'>
): void {
  const { exact } = save.version
  const matches =
    exact === EXPECTED_VERSION[gameId] ||
    (exact === 'RubySapphire' && RUBY_SAPPHIRE.has(gameId))
  if (!matches) {
    throw new Error(
      `This is a ${save.version.aggregated} save, not a ${GAME_LABEL[gameId]} save.`
    )
  }
}

/**
 * The Gen 3 games a save can belong to: one game, both Ruby and Sapphire for
 * their shared format, or none when it is not a Gen 3 save.
 */
export function gameIdsFromSave(
  save: Pick<SaveGame, 'version'>
): readonly Gen3GameId[] {
  const { exact } = save.version
  if (exact === 'RubySapphire') return [...RUBY_SAPPHIRE]
  return (Object.keys(EXPECTED_VERSION) as Gen3GameId[]).filter(
    (gameId) => EXPECTED_VERSION[gameId] === exact
  )
}
