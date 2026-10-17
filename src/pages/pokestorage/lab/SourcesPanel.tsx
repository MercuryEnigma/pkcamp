import type { Gen3GameId } from '../../../services/saveLibrary'
import { GAME_LABEL } from '../gameDisplay'
import {
  CAMP_SOURCE,
  type CabinScanStatus,
  type CampScanStatus,
  type LabSourceId,
} from './collectionTypes'
import { GEN_3_GAMES } from './labStore'

const SCAN_NOTE =
  'Scans saved Cabin files and Gen 3 Camp Sites. Unsaved changes are not included.'

function statusText(
  hasSave: boolean,
  loaded: boolean,
  cabin: CabinScanStatus | undefined
): string {
  if (cabin?.state === 'error') return `Error: ${cabin.message}`
  if (cabin?.state === 'ok') return `${cabin.count} Pokémon`
  if (hasSave) return 'Saved'
  return loaded ? 'No save' : 'Checking…'
}

function campStatusText(
  count: number | null,
  camp: CampScanStatus | null
): string {
  if (camp?.state === 'error') return `Error: ${camp.message}`
  if (count === null) return 'Checking…'
  if (count === 0) return 'No Pokémon'
  const unreadable =
    camp?.state === 'ok' && camp.unreadable > 0
      ? ` · ${camp.unreadable} unreadable`
      : ''
  return `${count} Pokémon${unreadable}`
}

/**
 * The source checklist: each Cabin, then the Camp Sites. A source with
 * nothing stored is disabled.
 */
export function SourcesPanel({
  saves,
  campCount,
  selected,
  cabins,
  camp,
  onToggle,
}: {
  saves: Partial<Record<Gen3GameId, Date | null>> | null
  campCount: number | null
  selected: readonly LabSourceId[]
  cabins: readonly CabinScanStatus[]
  camp: CampScanStatus | null
  onToggle: (source: LabSourceId) => void
}) {
  const hasCamp = (campCount ?? 0) > 0
  return (
    <section className="lab-panel">
      <h2 className="lab-heading">Sources</h2>
      <ul className="lab-sources">
        {GEN_3_GAMES.map((gameId) => {
          const hasSave = Boolean(saves?.[gameId])
          const cabin = cabins.find((c) => c.gameId === gameId)
          return (
            <li key={gameId}>
              <label className={hasSave ? '' : 'lab-disabled'}>
                <input
                  type="checkbox"
                  checked={hasSave && selected.includes(gameId)}
                  disabled={!hasSave}
                  onChange={() => onToggle(gameId)}
                />{' '}
                {GAME_LABEL[gameId]}
              </label>
              <span className="lab-source-status">
                {statusText(hasSave, saves !== null, cabin)}
              </span>
            </li>
          )
        })}
        <li>
          <label className={hasCamp ? '' : 'lab-disabled'}>
            <input
              type="checkbox"
              checked={hasCamp && selected.includes(CAMP_SOURCE)}
              disabled={!hasCamp}
              onChange={() => onToggle(CAMP_SOURCE)}
            />{' '}
            Camp Sites
          </label>
          <span className="lab-source-status">
            {campStatusText(campCount, camp)}
          </span>
        </li>
      </ul>
      <p className="lab-note">{SCAN_NOTE}</p>
    </section>
  )
}
