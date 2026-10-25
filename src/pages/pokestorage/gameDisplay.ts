import type { Gen3GameId } from '../../services/saveLibrary'
import { i18n } from '../../services/i18n'

/** Canonical English names for filenames; use getGameLabel() for UI text. */
export const GAME_LABEL: Record<Gen3GameId, string> = {
  ruby: 'Ruby',
  sapphire: 'Sapphire',
  emerald: 'Emerald',
  firered: 'FireRed',
  leafgreen: 'LeafGreen',
}

/** Resolve on each render so changing language updates selectors and headers. */
export function getGameLabel(gameId: Gen3GameId): string {
  if (!Object.hasOwn(GAME_LABEL, gameId)) return gameId
  return i18n.t(`common:games.${gameId}`)
}
