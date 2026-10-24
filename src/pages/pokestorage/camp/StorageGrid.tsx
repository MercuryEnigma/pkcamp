import type { SaveSlot } from '../../../services/pkhex'
import type { SpriteResolver } from '../../../services/sprites'
import { Panel } from '../../hub/Panel'
import { PokemonSlotIcon, type SlotSelection } from '../PokemonSlotIcon'
import { COLUMNS, GRID_SIZE } from './groupMove'

/**
 * One box, the party or a Camp Site: a rounded panel with its name in a pill
 * between arrows, over a 6 × 5 grid that scales to the space it is given.
 */
export function StorageGrid({
  label,
  title,
  slots,
  resolver,
  selection,
  onPrevious,
  onNext,
  onSlot,
}: {
  /** Accessible name of the panel, e.g. "Save" or "Camp Site". */
  label: string
  /** The pill: "Box 1", "Party", "Camp 1". */
  title: string
  slots: readonly SaveSlot[]
  resolver: SpriteResolver
  selection: (slot: number) => SlotSelection
  onPrevious: () => void
  onNext: () => void
  onSlot: (slot: number) => void
}) {
  return (
    <Panel label={label} className="storage-grid">
      <div className="storage-grid-nav">
        <button type="button" aria-label="Previous" onClick={onPrevious}>
          ◀
        </button>
        <h2 className="storage-grid-pill">{title}</h2>
        <button type="button" aria-label="Next" onClick={onNext}>
          ▶
        </button>
      </div>
      <div className="storage-grid-body">
        <div
          className="storage-slots"
          style={{ aspectRatio: `${COLUMNS} / 5` }}
        >
          {Array.from({ length: GRID_SIZE }, (_, index) =>
            index < slots.length ? (
              <PokemonSlotIcon
                key={index}
                slot={slots[index]}
                resolver={resolver}
                size="100%"
                selected={selection(index)}
                onClick={() => onSlot(index)}
              />
            ) : (
              <span key={index} className="storage-slot-unused" />
            )
          )}
        </div>
      </div>
    </Panel>
  )
}
