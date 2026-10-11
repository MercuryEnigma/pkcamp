import { useEffect, useMemo, useRef, useState } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import { usePkHex } from '../../context/PkHexContext'
import { GAME_LABEL } from '../gameDisplay'
import { useSpriteResolver } from '../useStorage'
import { BUILT_IN_COLLECTIONS, isBuiltInId } from './builtInCollections'
import { CollectionGrid, EntryDetails } from './CollectionGrid'
import type { CollectionDefinition } from './collectionTypes'
import {
  formatRelative,
  STATUS_FILTERS,
  type StatusFilter,
} from './entryDisplay'
import {
  GEN_3_GAMES,
  loadSelectedSources,
  saveSelectedSources,
} from './labStore'
import { useCollectionScans } from './useCollectionScan'
import { CollectionDashboard } from './CollectionDashboard'
import { SourcesPanel } from './SourcesPanel'
import { useUploadedCollections } from './useUploadedCollections'

export function CollectionView({
  onBack,
  onOpenCabin,
  cabinReturns,
}: {
  onBack: () => void
  /** Opens a Cabin in the Camp Zone; this view stays mounted underneath. */
  onOpenCabin: (gameId: Gen3GameId, box?: number) => void
  /** Bumped each time the player comes back from a Cabin. */
  cabinReturns: number
}) {
  const {
    uploads,
    errors: uploadErrors,
    clearErrors,
    upload,
    remove,
  } = useUploadedCollections()
  const [collectionId, setCollectionId] = useState(BUILT_IN_COLLECTIONS[0].id)
  const [page, setPage] = useState<'collections' | 'grid' | 'entry'>(
    'collections'
  )
  const [sources, setSources] = useState(loadSelectedSources)
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
  const { scans, refresh } = useCollectionScans(definitions, sources)
  const scan = scans[definition.id]
  const resolver = useSpriteResolver()
  const seenReturns = useRef(cabinReturns)
  useEffect(() => {
    if (cabinReturns === seenReturns.current) return
    seenReturns.current = cabinReturns
    refresh()
  }, [cabinReturns, refresh])
  const { loading: pkhexLoading, error: pkhexError } = usePkHex()

  const effectiveSources: readonly Gen3GameId[] =
    sources ?? GEN_3_GAMES.filter((id) => scan.saves?.[id])

  const toggleSource = (gameId: Gen3GameId) => {
    const next = effectiveSources.includes(gameId)
      ? effectiveSources.filter((id) => id !== gameId)
      : GEN_3_GAMES.filter(
          (id) => id === gameId || effectiveSources.includes(id)
        )
    setSources(next)
    saveSelectedSources(next)
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
        'Reset history? Seen entries will go back to Unseen unless a Cabin owns them now.'
      )
    ) {
      scan.resetHistory()
    }
  }

  const result = scan.result
  const noSaves =
    scan.saves !== null && GEN_3_GAMES.every((id) => !scan.saves?.[id])
  const busy = scan.phase !== 'idle'
  const pct =
    result && result.total > 0 ? (result.owned / result.total) * 100 : 0
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
            onOpenCabin={onOpenCabin}
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
                ? `${result.owned} / ${result.total} registered`
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
                selected={effectiveSources}
                cabins={scan.cabins}
                onToggle={toggleSource}
              />
            </details>
          </div>

          {noSaves && (
            <p className="lab-banner">
              No Gen 3 saves are stored yet. Add a save to a Cabin in the Camp
              Zone Lodges, then come back.
            </p>
          )}
          {!noSaves && scan.saves && scan.targets.length === 0 && (
            <p className="lab-banner">
              No Cabins are selected. Pick at least one Cabin above to scan.
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
          {scan.failedCabins.length > 0 && (
            <p className="lab-warning" role="alert">
              Could not read{' '}
              {scan.failedCabins.map((id) => GAME_LABEL[id]).join(', ')}. These
              results are partial and were not saved.
            </p>
          )}

          {result ? (
            <>
              <section className="lab-panel">
                <div className="lab-progress-head">
                  <span className="lab-progress-main">
                    Registered {result.owned} / {result.total}
                  </span>
                  {result.seen > 0 && (
                    <span className="lab-progress-seen">
                      {result.seen} seen
                    </span>
                  )}
                </div>
                <div
                  className="lab-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={result.total}
                  aria-valuenow={result.owned}
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
                    disabled={busy || scan.offline || scan.targets.length === 0}
                    onClick={scan.rebuild}
                  >
                    Rebuild
                  </button>
                  <button
                    type="button"
                    className="camp-text-btn camp-text-btn--danger"
                    disabled={busy || scan.offline || scan.targets.length === 0}
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
