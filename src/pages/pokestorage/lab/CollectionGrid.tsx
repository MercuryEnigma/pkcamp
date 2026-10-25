import { useEffect, useLayoutEffect, useRef } from 'react'
import type { SpriteResolver } from '../../../services/sprites'
import type { EntryStatus } from './collectionTypes'
import { OptionGroup } from '../../hub/OptionGroup'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from '../spriteDisplay'
import type { CollectionDefinition } from './collectionTypes'
import { PcMeter } from './CollectionHome'
import type { EntryFilterField } from './entryFilter'
import {
  STATUS_FILTERS,
  collectionEntryLabel,
  entryDexNumber,
  entrySpriteRequest,
  type StatusFilter,
} from './entryDisplay'

/** Screen 2: one collection's entries as a searchable grid of tiles. */
export function CollectionGrid({
  definition,
  rows,
  statuses,
  registered,
  total,
  selectedId,
  query,
  filter,
  scanning,
  resolver,
  initialScroll,
  restoreKey,
  onScrollChange,
  onQuery,
  onFilter,
  onSelect,
  filters,
  onClearFilter,
  onBack,
}: {
  definition: CollectionDefinition
  /** Entry ids after search and filter. */
  rows: readonly string[]
  statuses: Readonly<Record<string, EntryStatus | undefined>>
  registered: number
  total: number
  selectedId: string | null
  query: string
  filter: StatusFilter
  scanning: boolean
  resolver: SpriteResolver
  initialScroll: number
  /** Changes when the scroll position must be restored again. */
  restoreKey: number
  /** Remembers the scroll position when the grid goes away. */
  onScrollChange: (scrollTop: number) => void
  onQuery: (query: string) => void
  onFilter: (filter: StatusFilter) => void
  onSelect: (id: string) => void
  /** The filters from the Filters screen in effect. */
  filters: readonly { field: EntryFilterField; label: string }[]
  onClearFilter: (field: EntryFilterField) => void
  onBack: () => void
}) {
  const list = useRef<HTMLUListElement>(null)
  const scroll = useRef(initialScroll)
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = scroll.current
  }, [restoreKey])
  useEffect(() => () => onScrollChange(scroll.current), [onScrollChange])

  return (
    <div className="pc-screen-body">
      <header className="pc-grid-header">
        <button type="button" className="pc-back" onClick={onBack}>
          ‹ Collections
        </button>
        <h2>{definition.name}</h2>
        <p className="pc-count" aria-live="polite">
          <strong>
            {registered} / {total}
          </strong>
          <span className="pc-label">Registered</span>
        </p>
        <PcMeter value={registered} total={total} label="Registered" />
      </header>
      <div className="pc-filters">
        <input
          type="search"
          placeholder="Search Pokémon…"
          aria-label="Search entries"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
        />
        <OptionGroup
          label="Status filter"
          options={STATUS_FILTERS.map((o) => [o.value, o.label] as const)}
          value={filter}
          onChange={onFilter}
        />
        {filters.map(({ field, label }) => (
          <button
            key={field}
            type="button"
            className="pc-chip"
            onClick={() => onClearFilter(field)}
          >
            {label} ✕
          </button>
        ))}
      </div>
      <ul
        ref={list}
        className="pc-grid"
        aria-label="Entries"
        onScroll={(event) => {
          scroll.current = event.currentTarget.scrollTop
        }}
      >
        {rows.map((id) => {
          const status = statuses[id] ?? 'unseen'
          const dex = entryDexNumber(definition.pokemon[id])
          return (
            <li key={id}>
              <button
                type="button"
                className="pc-cell"
                data-status={status}
                aria-pressed={id === selectedId}
                onClick={() => onSelect(id)}
              >
                {dex !== null && (
                  <span className="pc-cell-number">
                    #{String(dex).padStart(3, '0')}
                  </span>
                )}
                <img
                  src={spriteDisplayImageSrc(
                    resolveSpriteDisplay(
                      resolver,
                      entrySpriteRequest(id, definition.pokemon[id])
                    )
                  )}
                  alt=""
                  loading="lazy"
                />
                <span className="pc-cell-name">
                  {collectionEntryLabel(definition, id)}
                </span>
                {status !== 'unseen' && (
                  <span
                    className="pc-cell-badge"
                    role="img"
                    aria-label={status === 'owned' ? 'Owned' : 'Seen'}
                  />
                )}
              </button>
            </li>
          )
        })}
        {rows.length === 0 && (
          <li className="pc-empty">
            {scanning ? 'Scanning…' : 'No entries match.'}
          </li>
        )}
      </ul>
    </div>
  )
}
