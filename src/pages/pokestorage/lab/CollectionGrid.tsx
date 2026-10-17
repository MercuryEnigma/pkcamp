import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { GAME_LABEL } from '../gameDisplay'
import type { CampDestination } from '../PokeStorageMain'
import { GEN_3_GAMES } from './labStore'
import type { SpriteResolver } from '../../../services/sprites'
import type { StoredCollectionResult } from '../../../services/storage'
import { resolveSpriteDisplay, spriteDisplayImageSrc } from '../spriteDisplay'
import { type CollectionDefinition, type EntryStatus } from './collectionTypes'
import {
  entryDexNumber,
  collectionEntryLabel,
  entrySpriteRequest,
  formatDate,
  requirementFields,
  speciesName,
  type StatusFilter,
} from './entryDisplay'

interface DisplayGroup {
  id: string
  name: string
  entryIds: string[]
}

/** Definition groups in order, then any entry no group lists under "Other". */
function displayGroups(definition: CollectionDefinition): DisplayGroup[] {
  const groups: DisplayGroup[] = definition.groups.map((group) => ({
    id: group.id,
    name: group.name,
    entryIds: group.pokemon,
  }))
  const listed = new Set(definition.groups.flatMap((group) => group.pokemon))
  const other = Object.keys(definition.pokemon).filter((id) => !listed.has(id))
  if (other.length > 0) {
    groups.push({ id: '(other)', name: 'Other', entryIds: other })
  }
  return groups
}

function matchesQuery(
  definition: CollectionDefinition,
  entryId: string,
  query: string
): boolean {
  const constraints = definition.pokemon[entryId]
  const dex = entryDexNumber(constraints)
  const haystack = [
    collectionEntryLabel(definition, entryId),
    entryId,
    dex === null ? '' : String(dex),
    dex === null ? '' : String(dex).padStart(3, '0'),
  ]
  return haystack.some((text) => text.toLowerCase().includes(query))
}

export function CollectionGrid({
  definition,
  result,
  resolver,
  filter,
  query,
  selectedId,
  onSelect,
}: {
  definition: CollectionDefinition
  result: StoredCollectionResult
  resolver: SpriteResolver
  filter: StatusFilter
  query: string
  selectedId: string | null
  onSelect: (entryId: string) => void
}) {
  const groups = useMemo(() => displayGroups(definition), [definition])
  const needle = query.trim().toLowerCase()
  const statusOf = (entryId: string): EntryStatus =>
    result.entries[entryId]?.status ?? 'unseen'

  const sections = groups.map((group) => {
    const visible = group.entryIds.filter(
      (id) =>
        (filter === 'all' ||
          (filter === 'missing'
            ? statusOf(id) !== 'owned'
            : statusOf(id) === filter)) &&
        (needle === '' || matchesQuery(definition, id, needle))
    )
    return { group, visible }
  })

  const viewport = useRef<HTMLDivElement>(null)
  const [previewId, setPreviewId] = useState<string | null>(selectedId)
  // Every matching entry, in one list that scrolls. Sprites load lazily,
  // so long collections stay light.
  const shown = [...new Set(sections.flatMap((section) => section.visible))]
  const activeId = shown.includes(previewId ?? '')
    ? previewId!
    : shown.includes(selectedId ?? '')
      ? selectedId!
      : shown[0]
  const activeConstraints = activeId ? definition.pokemon[activeId] : null
  const activeDisplay = activeConstraints
    ? resolveSpriteDisplay(
        resolver,
        entrySpriteRequest(activeId, activeConstraints)
      )
    : null
  const activeStatus = activeId ? statusOf(activeId) : 'unseen'
  const activeDex = activeConstraints ? entryDexNumber(activeConstraints) : null
  const statusLabel = (status: EntryStatus) =>
    status === 'owned'
      ? 'Registered'
      : status === 'seen'
        ? 'Previously registered'
        : 'Missing'
  const groupNames = sections
    .filter((section) => section.visible.length > 0)
    .map((section) => section.group.name)

  // Coming back from an entry: bring its row into view.
  useEffect(() => {
    if (!selectedId) return
    viewport.current
      ?.querySelector(`[data-entry-id="${CSS.escape(selectedId)}"]`)
      ?.scrollIntoView({ block: 'center' })
  }, [selectedId])

  // A new search or filter starts at the top of the list. Skipped on first
  // render so it can't undo the scroll to a returning entry above.
  const lastSearch = useRef(`${filter}|${needle}`)
  useEffect(() => {
    const search = `${filter}|${needle}`
    if (search === lastSearch.current) return
    lastSearch.current = search
    viewport.current?.scrollTo({ top: 0 })
  }, [filter, needle])
  const moveSelection = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSelect(shown[index])
      return
    }
    const next =
      event.key === 'ArrowDown'
        ? Math.min(index + 1, shown.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(index - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? shown.length - 1
              : null
    if (next === null) return
    event.preventDefault()
    setPreviewId(shown[next])
    const row =
      viewport.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[
        next
      ]
    row?.focus({ preventScroll: true })
    row?.scrollIntoView({ block: 'nearest' })
  }
  return (
    <div className="pokedex-browser">
      <div className="pokedex-grid-heading">
        <span>{groupNames.join(' · ') || 'Entries'}</span>
        <span>{shown.length} entries</span>
      </div>
      <div className="pokedex-index">
        <aside
          className="pokedex-preview"
          aria-label="Selected Pokédex entry"
          aria-live="polite"
        >
          {activeConstraints && activeDisplay ? (
            <>
              <span className="pokedex-preview-number">
                {activeDex !== null
                  ? `No. ${String(activeDex).padStart(3, '0')}`
                  : activeId}
              </span>
              <div
                className={`pokedex-preview-display pokedex-preview-display--${activeStatus}`}
              >
                <img
                  key={spriteDisplayImageSrc(activeDisplay)}
                  src={spriteDisplayImageSrc(activeDisplay)}
                  alt=""
                />
              </div>
              <h2>{collectionEntryLabel(definition, activeId)}</h2>
              <span className="pokedex-preview-status">
                {statusLabel(activeStatus)}
              </span>
              <dl className="pokedex-preview-fields">
                {requirementFields(activeConstraints)
                  .slice(0, 2)
                  .map(({ label, value }) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
              </dl>
              <button
                type="button"
                className="camp-upload-btn"
                onClick={() => onSelect(activeId)}
              >
                View record →
              </button>
            </>
          ) : (
            <p className="lab-note">No entries match this filter.</p>
          )}
        </aside>
        <div ref={viewport} className="pokedex-list-viewport">
          <ul
            className="pokedex-index-list"
            role="listbox"
            aria-label="Collection entries"
          >
            {shown.map((entryId, index) => {
              const constraints = definition.pokemon[entryId]
              const dex = entryDexNumber(constraints)
              const status = statusOf(entryId)
              const display = resolveSpriteDisplay(
                resolver,
                entrySpriteRequest(entryId, constraints)
              )
              return (
                <li key={entryId} role="presentation">
                  <button
                    type="button"
                    role="option"
                    data-entry-id={entryId}
                    aria-selected={activeId === entryId}
                    aria-label={`${collectionEntryLabel(definition, entryId)}, ${statusLabel(status)}`}
                    tabIndex={activeId === entryId ? 0 : -1}
                    className={`pokedex-index-row${activeId === entryId ? ' pokedex-index-row--active' : ''}`}
                    onClick={() => setPreviewId(entryId)}
                    onDoubleClick={() => onSelect(entryId)}
                    onKeyDown={(event) => moveSelection(event, index)}
                  >
                    <span className="pokedex-row-number">
                      {dex !== null ? String(dex).padStart(3, '0') : '—'}
                    </span>
                    <img
                      src={spriteDisplayImageSrc(display)}
                      alt=""
                      loading="lazy"
                      className={
                        status === 'owned' ? '' : 'pokedex-row-missing'
                      }
                    />
                    <span className="pokedex-row-name">
                      {collectionEntryLabel(definition, entryId)}
                    </span>
                    <span className="pokedex-row-status" aria-hidden="true">
                      {status === 'owned' ? '✓' : '·'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function EntryDetails({
  definition,
  result,
  resolver,
  entryId,
  onClose,
  onOpenInCamp,
}: {
  definition: CollectionDefinition
  result: StoredCollectionResult
  resolver: SpriteResolver
  entryId: string
  onClose: () => void
  /** Opens where a match was found: its Cabin or the Camp Sites. */
  onOpenInCamp: (destination: CampDestination) => void
}) {
  const constraints = definition.pokemon[entryId]
  if (!constraints) return null
  const entry = result.entries[entryId]
  const status = entry?.status ?? 'unseen'
  const registered = status === 'owned'
  const label = collectionEntryLabel(definition, entryId)
  const dex = entryDexNumber(constraints)
  const display = resolveSpriteDisplay(
    resolver,
    entrySpriteRequest(entryId, constraints)
  )
  const matches = entry?.matches ?? []

  return (
    <article className="pokedex-entry">
      <header className="camp-page-header">
        <button type="button" className="camp-back" onClick={onClose}>
          ← Back
        </button>
        <div className="camp-page-heading">
          <p className="camp-eyebrow">Lab Zone · Pokédex · {definition.name}</p>
        </div>
        <span className="camp-page-header-spacer" aria-hidden="true" />
      </header>

      <section
        className={`pokedex-identity${registered ? '' : ' pokedex-identity--missing'}`}
      >
        <img
          className="pokedex-identity-sprite"
          src={spriteDisplayImageSrc(display)}
          alt=""
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden'
          }}
        />
        <h1 className="pokedex-identity-name">
          {dex !== null && (
            <span className="pokedex-identity-dex">
              #{String(dex).padStart(3, '0')}
            </span>
          )}{' '}
          {label}
        </h1>
        <span className={`lab-status lab-status--${status}`}>
          {registered ? 'Registered' : status === 'seen' ? 'Seen' : 'Missing'}
        </span>
        {status === 'seen' && entry?.lastOwnedAt && (
          <p className="lab-note">
            Previously registered · Last owned {formatDate(entry.lastOwnedAt)}
          </p>
        )}
      </section>

      <section className="lab-panel pokedex-record">
        <h2 className="lab-label">Collection requirement</h2>
        <dl className="pokedex-fields">
          {requirementFields(constraints).map(({ label, value }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="pokedex-found">
        <h2 className="lab-label">Currently found</h2>
        {matches.length > 0 ? (
          <ul className="pokedex-matches">
            {matches.map((match, index) => {
              const species = speciesName(match.species)
              const camp = 'camp' in match
              const gameId = camp
                ? undefined
                : GEN_3_GAMES.find((id) => id === match.gameId)
              const where = camp
                ? 'Camp Sites'
                : `${gameId ? GAME_LABEL[gameId] : match.gameId} Cabin`
              const position = camp
                ? `Site ${match.location.site + 1} · Space ${match.location.index + 1}`
                : match.location === 'party'
                  ? 'Party'
                  : `Room ${match.location.box + 1}${match.boxName ? ` · ${match.boxName}` : ''} · Slot ${match.location.slot + 1}`
              const destination: CampDestination | null = camp
                ? { name: 'campSites', site: match.location.site }
                : gameId
                  ? {
                      name: 'cabin',
                      gameId,
                      box:
                        match.location === 'party'
                          ? undefined
                          : match.location.box,
                    }
                  : null
              return (
                <li className="pokedex-match" key={index}>
                  <div className="pokedex-match-where">
                    <span className="lab-label">{where}</span>
                    <span className="lab-note">{position}</span>
                  </div>
                  <div className="pokedex-match-what">
                    <span className="pokedex-match-pokemon">
                      <span className="pokedex-match-species">{species}</span>
                      {match.nickname &&
                      match.nickname.toUpperCase() !== species.toUpperCase()
                        ? ` · ${match.nickname}`
                        : ''}
                      {` · Lv. ${match.level}`}
                      {match.shiny ? ' · Shiny' : ''}
                    </span>
                    {destination && (
                      <button
                        type="button"
                        className="camp-upload-btn"
                        onClick={() => onOpenInCamp(destination)}
                      >
                        {camp ? 'Go to Camp Sites →' : 'Go to cabin →'}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="pokedex-empty">
            No matching Pokémon in the selected Cabins or Camp Sites.
          </p>
        )}
        <p className="pokedex-scan-note">
          From the last scan of the selected saved Cabins and Camp Sites.
          Unsaved changes are not included.
        </p>
      </section>
    </article>
  )
}
