import { useState } from 'react'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import type { CollectionDefinition } from './collectionTypes'
import { useLabData } from './useLabData'

/**
 * The Lab's collection data in active storage: uploaded collections can be
 * deleted; built-ins stay, but their saved history can be cleared.
 */
export function LabCollectionData({ offline }: { offline: boolean }) {
  const { ready, uploads, errors, remove, clearHistory, removeAll } =
    useLabData()
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<boolean>, done: string) => {
    setBusy(true)
    setMessage(null)
    try {
      if (await action()) setMessage(done)
    } finally {
      setBusy(false)
    }
  }
  const row = (definition: CollectionDefinition, uploaded: boolean) => (
    <li className="lab-data-row" key={definition.id}>
      <span className="lab-data-name">
        {definition.name}
        <small>{uploaded ? 'Uploaded' : 'Built-in'}</small>
      </span>
      <button
        type="button"
        className="camp-text-btn camp-text-btn--danger"
        disabled={busy || offline}
        onClick={() =>
          void (uploaded
            ? run(() => remove(definition), `"${definition.name}" deleted.`)
            : run(
                () => clearHistory(definition),
                `"${definition.name}" history cleared.`
              ))
        }
      >
        {uploaded ? 'Delete' : 'Clear history'}
      </button>
    </li>
  )

  return (
    <div className="camp-cabin-card">
      <div className="camp-cabin-head">
        <strong className="camp-cabin-name">Pokédex Collections</strong>
      </div>
      <p className="camp-cabin-status">
        Collections and their registered history are kept in the active storage.
        Built-in collections can't be deleted, only cleared; the next scan
        rebuilds them from your saves.
      </p>
      {ready ? (
        <ul className="lab-data-list">
          {BUILT_IN_COLLECTIONS.map((definition) => row(definition, false))}
          {uploads.map((definition) => row(definition, true))}
        </ul>
      ) : (
        <p className="lab-note">Loading collections…</p>
      )}
      {errors.length > 0 && (
        <div className="lab-warning" role="alert">
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p className="camp-status">{message}</p>}
      <div className="camp-cabin-footer">
        <button
          type="button"
          className="camp-text-btn camp-text-btn--danger"
          disabled={!ready || busy || offline}
          onClick={() => void run(removeAll, 'All collection data deleted.')}
        >
          Delete all collections
        </button>
      </div>
    </div>
  )
}
