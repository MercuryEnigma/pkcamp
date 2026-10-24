import type { Gen3GameId } from '../../services/saveLibrary'
import { CampPage } from './camp/CampPage'

/**
 * A Camp screen another zone can open directly, e.g. the PC showing where an
 * entry was found.
 */
export type CampDestination =
  | { name: 'cabin'; gameId: Gen3GameId; box?: number }
  | { name: 'campSites'; site?: number }

/** The Camp page, with where Back leads when a PC entry opened it. */
export function PokeStorageMain({
  onBack,
  destination,
  onReturn,
}: {
  /** Leaves Camp for the Hub. */
  onBack?: () => void
  /** The box or Camp Site to open on. */
  destination?: CampDestination
  /** Back goes here (e.g. the PC) instead of the Hub. */
  onReturn?: () => void
}) {
  return (
    <CampPage
      destination={destination}
      onBack={onReturn ?? onBack ?? (() => {})}
    />
  )
}
