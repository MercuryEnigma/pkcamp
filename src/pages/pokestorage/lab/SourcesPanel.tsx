import type { Gen3GameId } from '../../../services/saveLibrary'
import { GAME_LABEL } from '../gameDisplay'
import type { CabinScanStatus } from './collectionTypes'
import { GEN_3_GAMES } from './labStore'

const SCAN_NOTE =
  'Scans saved Cabin files only. Unsaved Camp changes and Camp Sites are not included.'

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

/** The Cabin checklist; Cabins without a stored save are disabled. */
export function SourcesPanel({
  saves,
  selected,
  cabins,
  onToggle,
}: {
  saves: Partial<Record<Gen3GameId, Date | null>> | null
  selected: readonly Gen3GameId[]
  cabins: readonly CabinScanStatus[]
  onToggle: (gameId: Gen3GameId) => void
}) {
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
      </ul>
      <p className="lab-note">{SCAN_NOTE}</p>
    </section>
  )
}
