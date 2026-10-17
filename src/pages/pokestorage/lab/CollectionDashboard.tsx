import { useRef, useState } from 'react'
import type { CollectionDefinition } from './collectionTypes'
import type { CollectionScanState } from './useCollectionScan'
import { researchAvailability, researchSummary } from './researchDisplay'

function Progress({
  owned,
  total,
  label,
}: {
  owned: number
  total: number
  label: string
}) {
  return (
    <div
      className="lab-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={owned}
    >
      <div
        className="lab-bar-fill"
        style={{ width: `${total ? (owned / total) * 100 : 0}%` }}
      />
    </div>
  )
}

function CollectionCard({
  definition,
  scan,
  onSelect,
}: {
  definition: CollectionDefinition
  scan: CollectionScanState
  onSelect: (id: string) => void
}) {
  const availability = researchAvailability(scan)
  const owned = scan.result?.owned ?? null
  const total = Object.keys(definition.pokemon).length
  return (
    <button
      type="button"
      className="lab-panel pokedex-collection-card"
      onClick={() => onSelect(definition.id)}
    >
      <span className="lab-label">{definition.name}</span>
      <span className="pokedex-card-count">
        {owned === null ? '—' : owned} / {total}
      </span>
      <Progress
        owned={owned ?? 0}
        total={total}
        label={`${definition.name} registered entries`}
      />
      {availability !== 'ready' && (
        <span className="lab-note">
          {scan.storageError ??
            (availability === 'loading'
              ? 'Updating research…'
              : availability === 'unavailable'
                ? scan.offline
                  ? 'Offline · No stored research'
                  : 'Research unavailable'
                : availability === 'partial'
                  ? scan.offline
                    ? 'Offline · Stored research'
                    : 'Partial research · Open for details'
                  : `${owned} registered`)}
        </span>
      )}
    </button>
  )
}

export function CollectionDashboard({
  definitions,
  scans,
  onSelect,
  onBack,
  upload,
  errors,
}: {
  definitions: CollectionDefinition[]
  scans: Record<string, CollectionScanState>
  onSelect: (id: string) => void
  onBack: () => void
  upload: (file: File) => Promise<string | null>
  errors: string[]
}) {
  const input = useRef<HTMLInputElement>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const capacity = 6
  const pages = Math.max(1, Math.ceil(definitions.length / capacity))
  const page = Math.min(pageIndex, pages - 1)
  const shown = definitions.slice(page * capacity, (page + 1) * capacity)
  const total = definitions.reduce(
    (sum, definition) => sum + Object.keys(definition.pokemon).length,
    0
  )
  const summary = researchSummary(
    definitions.map((definition) => scans[definition.id])
  )
  return (
    <div className="camp-root pokedex-root">
      <div className="camp-content pokedex-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={onBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Lab Zone · Pokédex</p>
            <h1 className="camp-title">Pokédex Collections</h1>
            <p className="camp-page-subtitle">
              Track your research across different collections.
            </p>
          </div>
        </header>
        <section className="lab-panel pokedex-summary">
          <div className="lab-progress-head">
            <h2 className="lab-label">Research progress</h2>
            <strong>
              {summary.available > 0 ? summary.owned : '—'} / {total}
            </strong>
          </div>
          <Progress
            owned={summary.owned}
            total={total}
            label="Research progress across collection entries"
          />
          <p className="lab-note">
            {summary.availability === 'loading'
              ? 'Updating research…'
              : summary.availability === 'unavailable'
                ? 'Research unavailable.'
                : summary.availability === 'partial'
                  ? 'Partial research results.'
                  : 'Registered across collections.'}
          </p>
        </section>
        <section className="pokedex-collections">
          <h2 className="lab-label">Collections</h2>
          <div className="pokedex-collection-grid">
            {shown.map((definition) => (
              <CollectionCard
                key={definition.id}
                definition={definition}
                scan={scans[definition.id]}
                onSelect={onSelect}
              />
            ))}
          </div>
          <div className="pokedex-collection-actions">
            {pages > 1 && (
              <nav className="pokedex-pagination" aria-label="Collection pages">
                <button
                  type="button"
                  className="lab-chip"
                  disabled={page === 0}
                  onClick={() => setPageIndex(page - 1)}
                >
                  ← Previous
                </button>
                <span aria-live="polite">
                  Page {page + 1} / {pages}
                </span>
                <button
                  type="button"
                  className="lab-chip"
                  disabled={page + 1 >= pages}
                  onClick={() => setPageIndex(page + 1)}
                >
                  Next →
                </button>
              </nav>
            )}
            {/* <button
              type="button"
              className="camp-upload-btn"
              onClick={() => input.current?.click()}
            >
              + New Collection
            </button> */}
          </div>
          <input
            ref={input}
            className="camp-file-input--hidden"
            type="file"
            accept=".json,application/json"
            aria-label="Import collection"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) {
                const id = await upload(file)
                if (id) onSelect(id)
              }
            }}
          />
          {errors.length > 0 && (
            <div className="lab-warning" role="alert">
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
