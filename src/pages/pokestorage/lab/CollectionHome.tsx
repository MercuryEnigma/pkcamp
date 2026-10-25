import type { SpriteResolver } from '../../../services/sprites'
import type { StoredCollectionResult } from '../../../services/storage'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from '../spriteDisplay'
import type { CollectionDefinition } from './collectionTypes'
import { registeredCount } from './collectionTypes'
import { entrySpriteRequest } from './entryDisplay'

/** A progress bar for registered / total. */
export function PcMeter({
  value,
  total,
  label,
}: {
  value: number
  total: number
  label: string
}) {
  return (
    <div
      className="pc-meter"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
    >
      <span style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
    </div>
  )
}

/** Screen 1: the research summary and one tile per added collection. */
export function CollectionHome({
  definitions,
  results,
  firstEntryIds,
  resolver,
  available,
  onOpen,
  onAdd,
  onNew,
}: {
  /** The added collections, in display order. */
  definitions: readonly CollectionDefinition[]
  results: Readonly<Record<string, StoredCollectionResult | null>>
  /** Each collection's first entry id, for its tile's sprite. */
  firstEntryIds: Readonly<Record<string, string | undefined>>
  resolver: SpriteResolver
  /** Collections that exist but are not added to the Pokédex yet. */
  available: readonly CollectionDefinition[]
  onOpen: (id: string) => void
  onAdd: (id: string) => void
  onNew: () => void
}) {
  const totals = definitions.reduce(
    (sum, { id }) => {
      const result = results[id]
      return {
        registered: sum.registered + (result ? registeredCount(result) : 0),
        total: sum.total + (result?.total ?? 0),
      }
    },
    { registered: 0, total: 0 }
  )

  return (
    <div className="pc-screen-body">
      <header className="pc-summary">
        <div>
          <h2>Pokédex research system</h2>
          <span className="pc-label">Research progress</span>
        </div>
        <p className="pc-count" aria-live="polite">
          <strong>
            {totals.registered} / {totals.total}
          </strong>
          <span className="pc-label">Registered</span>
        </p>
        <PcMeter
          value={totals.registered}
          total={totals.total}
          label="Registered"
        />
      </header>
      <h3 className="pc-label">Collections</h3>
      <ul className="pc-tiles">
        {definitions.map((definition) => {
          const result = results[definition.id]
          const registered = result ? registeredCount(result) : 0
          const total = result?.total ?? 0
          const first = firstEntryIds[definition.id]
          const constraints = first ? definition.pokemon[first] : undefined
          return (
            <li key={definition.id}>
              <button
                type="button"
                className="pc-tile"
                onClick={() => onOpen(definition.id)}
              >
                {first && constraints && (
                  <img
                    src={spriteDisplayImageSrc(
                      resolveSpriteDisplay(
                        resolver,
                        entrySpriteRequest(first, constraints)
                      )
                    )}
                    alt=""
                    loading="lazy"
                  />
                )}
                <span className="pc-tile-text">
                  <strong>{definition.name}</strong>
                  <span>{result ? `${registered} / ${total}` : '—'}</span>
                  <PcMeter
                    value={registered}
                    total={total}
                    label={`${definition.name} registered`}
                  />
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className="pc-tile pc-tile--new"
            onClick={onNew}
          >
            + New collection
          </button>
        </li>
      </ul>
      {available.length > 0 && (
        <>
          <h3 className="pc-label">Available to add</h3>
          <ul className="pc-tiles">
            {available.map((definition) => (
              <li key={definition.id}>
                <button
                  type="button"
                  className="pc-tile pc-tile--available"
                  onClick={() => onAdd(definition.id)}
                >
                  <strong>{definition.name}</strong>
                  <span className="pc-label">+ Add</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
