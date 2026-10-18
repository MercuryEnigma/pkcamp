import { useEffect, useMemo, useRef, useState } from 'react'
import type { CampDestination } from '../PokeStorageMain'
import { usePkHex } from '../../context/PkHexContext'
import { useSpriteResolver } from '../useStorage'
import { BUILT_IN_COLLECTIONS, isBuiltInId } from './builtInCollections'
import { CollectionGrid, EntryDetails } from './CollectionGrid'
import {
  registeredCount,
  type CollectionDefinition,
  type LabSourceId,
} from './collectionTypes'
import {
  formatRelative,
  STATUS_FILTERS,
  type StatusFilter,
} from './entryDisplay'
import { CAMP_SOURCE } from './collectionTypes'
import { GEN_3_GAMES, LAB_SOURCES, sourceLabel } from './labStore'
import { useCollectionScans } from './useCollectionScan'
import { CollectionDashboard } from './CollectionDashboard'
import { SourcesPanel } from './SourcesPanel'
import { useLabData } from './useLabData'

export function CollectionView({
  onBack,
  onOpenInCamp,
  campReturns,
}: {
  onBack: () => void
  /** Opens a Camp Zone screen; this view stays mounted underneath. */
  onOpenInCamp: (destination: CampDestination) => void
  /** Bumped each time the player comes back from the Camp Zone. */
  campReturns: number
}) {
  const {
    ready: labReady,
    sources,
    setSources,
    uploads,
    errors: uploadErrors,
    clearErrors,
    upload,
    remove,
  } = useLabData()
  const [collectionId, setCollectionId] = useState(BUILT_IN_COLLECTIONS[0].id)
  const [page, setPage] = useState<'collections' | 'grid' | 'entry'>(
    'collections'
  )
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const definitions = useMemo(
    () => [...BUILT_IN_COLLECTIONS, ...uploads],
    [uploads]
  )
  const definition: CollectionDefinition =
    definitions.find((c) => c.id === collectionId) ?? BUILT_IN_COLLECTIONS[0]
  const { scans, refresh } = useCollectionScans(definitions, sources, labReady)
  const scan = scans[definition.id]
  const resolver = useSpriteResolver()
  const seenReturns = useRef(campReturns)
  useEffect(() => {
    if (campReturns === seenReturns.current) return
    seenReturns.current = campReturns
    refresh()
  }, [campReturns, refresh])
  const { loading: pkhexLoading, error: pkhexError } = usePkHex()

  // With no stored choice, every source holding data is scanned.
  const effectiveSources: readonly LabSourceId[] =
    sources ??
    LAB_SOURCES.filter((id) =>
      id === CAMP_SOURCE ? (scan.campCount ?? 0) > 0 : scan.saves?.[id]
    )

  const toggleSource = (source: LabSourceId) => {
    const next = effectiveSources.includes(source)
      ? effectiveSources.filter((id) => id !== source)
      : LAB_SOURCES.filter(
          (id) => id === source || effectiveSources.includes(id)
        )
    void setSources(next)
  }

  const selectCollection = (id: string) => {
    setCollectionId(id)
    setPage('grid')
    setFilter('all')
    setQuery('')
    setSelectedEntry(null)
    clearErrors()
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const id = await upload(file)
    if (id) selectCollection(id)
  }

  const removeUpload = async () => {
    if (await remove(definition)) {
      selectCollection(BUILT_IN_COLLECTIONS[0].id)
      setPage('collections')
    }
  }

  const handleReset = () => {
    if (
      window.confirm(
        'Reset history? Entries no longer in a Cabin or Camp Site will go back to Missing.'
      )
    ) {
      scan.resetHistory()
    }
  }

  const result = scan.result
  const noSaves =
    scan.saves !== null &&
    scan.campCount === 0 &&
    GEN_3_GAMES.every((id) => !scan.saves?.[id])
  const nothingSelected = scan.targets.length === 0 && !scan.campTarget
  const failedSources = [
    ...scan.failedCabins.map(sourceLabel),
    ...(scan.camp?.state === 'error' ? [sourceLabel(CAMP_SOURCE)] : []),
  ]
  const busy = scan.phase !== 'idle'
  const registered = result ? registeredCount(result) : 0
  const pct = result && result.total > 0 ? (registered / result.total) * 100 : 0
  const isUpload = !isBuiltInId(definition.id)

  if (page === 'collections')
    return (
      <CollectionDashboard
        definitions={definitions}
        scans={scans}
        onSelect={selectCollection}
        onBack={onBack}
        upload={upload}
        errors={uploadErrors}
      />
    )
  if (page === 'entry' && selectedEntry && result)
    return (
      <div className="camp-root pokedex-root">
        <div className="camp-content pokedex-content">
          <EntryDetails
            definition={definition}
            result={result}
            resolver={resolver}
            entryId={selectedEntry}
            onClose={() => setPage('grid')}
            onOpenInCamp={onOpenInCamp}
          />
        </div>
      </div>
    )
  return (
    <div className="camp-root pokedex-root">
      <div className="camp-content pokedex-content">
        <header className="camp-page-header">
          <button
            type="button"
            className="camp-back"
            onClick={() => setPage('collections')}
          >
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Lab Zone · Pokédex</p>
            <h1 className="camp-title">{definition.name}</h1>
            <p className="camp-page-subtitle">
              {result
                ? `${registered} / ${result.total} registered`
                : 'Preparing research…'}
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="lab-stack">
          <div className="pokedex-tool-row">
            <details className="pokedex-options">
              <summary>Collection options</summary>
              <section className="lab-panel">
                <div className="lab-row">
                  <label className="lab-field">
                    <span className="lab-label">Collection</span>
                    <select
                      className="camp-select"
                      value={definition.id}
                      onChange={(e) => selectCollection(e.target.value)}
                    >
                      {BUILT_IN_COLLECTIONS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                      {uploads.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Uploaded)
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="camp-text-btn"
                    onClick={() => fileInput.current?.click()}
                  >
                    Upload collection
                  </button>
                  {isUpload && (
                    <button
                      type="button"
                      className="camp-text-btn camp-text-btn--danger"
                      onClick={() => void removeUpload()}
                    >
                      Remove
                    </button>
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    className="camp-file-input--hidden"
                    aria-label="Upload collection file"
                    onChange={(e) => void handleUpload(e)}
                  />
                </div>
                {(definition.metadata.description ||
                  definition.metadata.author) && (
                  <p className="lab-note">
                    {definition.metadata.description}
                    {definition.metadata.author &&
                      ` By ${definition.metadata.author}.`}
                  </p>
                )}
                {uploadErrors.length > 0 && (
                  <div className="lab-warning" role="alert">
                    <p>That file could not be used:</p>
                    <ul>
                      {uploadErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </details>

            <details className="pokedex-sources">
              <summary>Research sources</summary>
              <SourcesPanel
                saves={scan.saves}
                campCount={scan.campCount}
                selected={effectiveSources}
                cabins={scan.cabins}
                camp={scan.camp}
                onToggle={toggleSource}
              />
            </details>
          </div>

          {noSaves && (
            <p className="lab-banner">
              No Gen 3 saves or Camping Pokémon are stored yet. Add a save to a
              Cabin or Pokémon to a Camp Site in the Camp Zone, then come back.
            </p>
          )}
          {!noSaves && scan.saves && nothingSelected && (
            <p className="lab-banner">
              No sources are selected. Pick at least one in Research sources.
            </p>
          )}
          {pkhexError && scan.waitingForPkHex && (
            <p className="lab-warning" role="alert">
              PKHeX failed to load: {pkhexError.message}
            </p>
          )}
          {scan.waitingForPkHex && pkhexLoading && (
            <p className="lab-note">Loading PKHeX…</p>
          )}
          {scan.offline && (
            <p className="lab-banner">
              Results can't be saved while Dropbox is offline.
              {result ? ' Showing the last stored result.' : ''}
            </p>
          )}
          {scan.storageError && (
            <p className="lab-warning" role="alert">
              {scan.storageError}
            </p>
          )}
          {failedSources.length > 0 && (
            <p className="lab-warning" role="alert">
              Could not read {failedSources.join(', ')}. These results are
              partial and were not saved.
            </p>
          )}

          {result ? (
            <>
              <section className="lab-panel">
                <div className="lab-progress-head">
                  <span className="lab-progress-main">
                    Registered {registered} / {result.total}
                  </span>
                  {result.seen > 0 && (
                    <span className="lab-progress-seen">
                      {result.owned} held now
                    </span>
                  )}
                </div>
                <div
                  className="lab-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={result.total}
                  aria-valuenow={registered}
                  aria-label="Registered entries"
                >
                  <div className="lab-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="lab-row">
                  <span className="lab-note">
                    {busy
                      ? 'Updating…'
                      : scan.unsaved
                        ? 'Not saved'
                        : `Last scanned ${formatRelative(result.scannedAt)}`}
                  </span>
                  <button
                    type="button"
                    className="camp-text-btn"
                    disabled={busy || scan.offline || nothingSelected}
                    onClick={scan.rebuild}
                  >
                    Rebuild
                  </button>
                  <button
                    type="button"
                    className="camp-text-btn camp-text-btn--danger"
                    disabled={busy || scan.offline || nothingSelected}
                    onClick={handleReset}
                  >
                    Reset history
                  </button>
                </div>
              </section>

              <div className="lab-row lab-filters">
                <input
                  type="search"
                  className="lab-search"
                  placeholder="Search name, number, or id"
                  aria-label="Search entries"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                  }}
                />
                <div
                  className="lab-chips"
                  role="group"
                  aria-label="Status filter"
                >
                  {STATUS_FILTERS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`lab-chip${filter === option.value ? ' lab-chip--active' : ''}`}
                      aria-pressed={filter === option.value}
                      onClick={() => {
                        setFilter(option.value)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <CollectionGrid
                definition={definition}
                result={result}
                resolver={resolver}
                filter={filter}
                query={query}
                selectedId={selectedEntry}
                onSelect={(id) => {
                  setSelectedEntry(id)
                  setPage('entry')
                }}
              />
            </>
          ) : (
            busy && (
              <p className="lab-note">
                {scan.phase === 'scanning' ? 'Scanning Cabins…' : 'Loading…'}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  )
}
