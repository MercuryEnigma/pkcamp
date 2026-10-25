import { useTranslation } from 'react-i18next'
import type { SaveSlot } from '../../../services/pkhex'
import type { Gen3GameId } from '../../../services/saveLibrary'
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
  source,
  gameId,
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
  /** A visual cue for the save cartridge or the Camp Sites. */
  source: 'save' | 'camp'
  gameId?: Gen3GameId | null
  slots: readonly SaveSlot[]
  resolver: SpriteResolver
  selection: (slot: number) => SlotSelection
  onPrevious: () => void
  onNext: () => void
  onSlot: (slot: number) => void
}) {
  const { t } = useTranslation(['camp', 'common'] as const)

  return (
    <Panel label={label} className="storage-grid">
      <div className="storage-grid-nav">
        <button
          type="button"
          aria-label={t('StorageGrid.previous', { label: label })}
          onClick={onPrevious}
        >
          <span aria-hidden="true">◀</span>
        </button>
        <span
          className="storage-grid-source"
          data-game={source === 'save' ? gameId : undefined}
          aria-hidden="true"
        >
          {source === 'save' ? (
            <span className="storage-grid-cartridge-icon" />
          ) : (
            <span className="storage-grid-tent-icon" />
          )}
        </span>
        <h2 className="storage-grid-pill">{title}</h2>
        <span className="storage-grid-counterweight" aria-hidden="true" />
        <button
          type="button"
          aria-label={t('StorageGrid.next', { label: label })}
          onClick={onNext}
        >
          <span aria-hidden="true">▶</span>
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
