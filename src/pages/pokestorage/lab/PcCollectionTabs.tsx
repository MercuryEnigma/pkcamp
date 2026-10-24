import { useRef, useState } from 'react'
import { Dialog } from '../../hub/Dialog'
import type { CollectionDefinition } from './collectionTypes'

/**
 * The two most recently viewed collections as tabs, a "…" picker for the
 * other added collections, and a "+" dialog to add collections (including a
 * collection JSON upload).
 */
export function PcCollectionTabs({
  definitions,
  enabledIds,
  recentIds,
  currentId,
  onOpen,
  onAdd,
  onUpload,
  uploadErrors,
}: {
  definitions: readonly CollectionDefinition[]
  enabledIds: readonly string[]
  recentIds: readonly string[]
  currentId: string
  onOpen: (id: string) => void
  /** Adds the chosen collections and scans them. */
  onAdd: (ids: string[]) => void
  /** Resolves true once the collection is added. */
  onUpload: (file: File) => Promise<boolean>
  uploadErrors: readonly string[]
}) {
  const [picker, setPicker] = useState(false)
  const [adding, setAdding] = useState(false)
  const [chosen, setChosen] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const name = (id: string) =>
    definitions.find((item) => item.id === id)?.name ?? id
  const tabs = [
    currentId,
    ...recentIds.filter((id) => id !== currentId && enabledIds.includes(id)),
  ].slice(0, 2)
  const others = enabledIds.filter((id) => !tabs.includes(id))
  const available = definitions.filter((item) => !enabledIds.includes(item.id))

  return (
    <div className="pc-tabs">
      {tabs.map((id) => (
        <button
          key={id}
          type="button"
          className="pc-tab"
          aria-pressed={id === currentId}
          onClick={() => onOpen(id)}
        >
          {name(id)}
        </button>
      ))}
      <button
        type="button"
        className="pc-tab"
        aria-label="Other collections"
        disabled={others.length === 0}
        onClick={() => setPicker(true)}
      >
        …
      </button>
      <button
        type="button"
        className="pc-tab"
        aria-label="Add a collection"
        onClick={() => {
          setChosen([])
          setAdding(true)
        }}
      >
        +
      </button>

      <Dialog
        title="Other collections"
        open={picker}
        onClose={() => setPicker(false)}
      >
        <ul className="pc-dialog-list">
          {others.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  onOpen(id)
                  setPicker(false)
                }}
              >
                {name(id)}
              </button>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        title="Add collections"
        open={adding}
        onClose={() => setAdding(false)}
      >
        {available.length > 0 ? (
          <ul className="pc-dialog-list">
            {available.map((item) => (
              <li key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={chosen.includes(item.id)}
                    onChange={(event) =>
                      setChosen(
                        event.target.checked
                          ? [...chosen, item.id]
                          : chosen.filter((id) => id !== item.id)
                      )
                    }
                  />
                  {item.name}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p>Every collection is already added.</p>
        )}
        <button
          type="button"
          disabled={chosen.length === 0}
          onClick={() => {
            onAdd(chosen)
            setAdding(false)
          }}
        >
          Add selected
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Upload collection JSON
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Upload collection file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file)
              void onUpload(file).then((added) => added && setAdding(false))
          }}
        />
        {uploadErrors.length > 0 && (
          <div role="alert">
            <p>That file could not be used:</p>
            <ul>
              {uploadErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </Dialog>
    </div>
  )
}
