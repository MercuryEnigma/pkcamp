import { useNavigationGuard } from './navigationGuard'
import { useEffect, useRef, useState } from 'react'
import type { CampPokemon } from '../../services/storage'
import { storage } from '../../services/storage'
import { usePkHex } from '../context/PkHexContext'
import { PokemonDetails } from './PokemonDetails'
import { PokemonSlotIcon } from './PokemonSlotIcon'
import {
  CAMP_SITE_SIZE,
  DEFAULT_CAMP_SITE_COUNT,
  campFromEntries,
  firstEmptyPosition,
  flatIndexOf,
  isSamePosition,
  loadCampEntries,
  positionOf,
  sitesFromFlat,
  type CampEntry,
  type CampPosition,
} from './campPositions'
import {
  storageErrorMessage,
  useSpriteResolver,
  useStorageOffline,
  useStorageProvider,
} from './useStorage'

const GENERATION = 3 as const
const FILE_EXTENSION = '.pk3'

function downloadPokemon(entry: CampEntry): void {
  const blob = new Blob([entry.file.bytes.slice()], {
    type: 'application/octet-stream',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = entry.file.fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function newLocalId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function LocalPokemonView({
  onBack,
  onUnsavedChangesChange,
  initialSite = 0,
}: {
  onBack: () => void
  /** Camp Site to show first (0-based), e.g. where a Lab entry was found. */
  initialSite?: number
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const { provider, ready } = useStorageProvider()
  const offline = useStorageOffline()
  const [entries, setEntries] = useState<(CampEntry | null)[]>(() =>
    new Array<null>(DEFAULT_CAMP_SITE_COUNT * CAMP_SITE_SIZE).fill(null)
  )
  const campLoadedRef = useRef(false)
  const unreadableRef = useRef<ReadonlyMap<number, CampPokemon>>(new Map())
  const [dirty, setDirty] = useState(false)
  const confirmLeave = useNavigationGuard(
    dirty,
    'You have unsaved changes. Leave without saving them?'
  )
  const [boxIndex, setBoxIndex] = useState(initialSite)
  const [selected, setSelected] = useState<CampPosition | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const resolver = useSpriteResolver()

  useEffect(() => {
    if (!adapter || !ready) return

    let cancelled = false
    campLoadedRef.current = false

    provider
      .getCamp(GENERATION)
      .then((camp) => {
        if (cancelled) return
        const loaded = loadCampEntries(camp, adapter)
        unreadableRef.current = loaded.unreadable
        campLoadedRef.current = true
        setEntries(loaded.entries)
        setDirty(false)
        setSelected(null)
        setBoxIndex((current) =>
          Math.min(current, Math.max(0, camp.sites.length - 1))
        )
        setMessage(
          loaded.unreadable.size > 0
            ? `${loaded.unreadable.size} stored Pokémon file${loaded.unreadable.size === 1 ? '' : 's'} could not be read.`
            : null
        )
      })
      .catch((cause: unknown) => {
        if (!cancelled) setMessage(storageErrorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false)
      })

    return () => {
      cancelled = true
    }
  }, [adapter, adapterLoading, provider, ready])

  useEffect(() => {
    onUnsavedChangesChange?.(dirty)
  }, [dirty, onUnsavedChangesChange])

  useEffect(() => {
    return () => onUnsavedChangesChange?.(false)
  }, [onUnsavedChangesChange])

  const selectedEntry = selected
    ? (entries[flatIndexOf(selected)] ?? null)
    : null
  const boxCount = entries.length / CAMP_SITE_SIZE
  const visibleEntries = entries.slice(
    boxIndex * CAMP_SITE_SIZE,
    (boxIndex + 1) * CAMP_SITE_SIZE
  )

  const cycleBox = (delta: number) => {
    setBoxIndex((current) => (current + delta + boxCount) % boxCount)
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter) return

    if (!file.name.toLowerCase().endsWith(FILE_EXTENSION)) {
      setMessage(`Choose a ${FILE_EXTENSION} file for your Camping Pokémon.`)
      return
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const pokemon = adapter.importPokemonFile(bytes)
      // The viewed Camp Site first, then the first empty position anywhere.
      // Unreadable files still occupy their positions; never import over one.
      const position = firstEmptyPosition(
        sitesFromFlat<unknown>(
          entries.map(
            (entry, index) => entry ?? unreadableRef.current.get(index) ?? null
          )
        ),
        boxIndex
      )
      if (!position) {
        throw new Error(
          'Camping Pokémon is full. Add another Camp Site in the Camp Office.'
        )
      }
      const stored: CampPokemon = {
        id: newLocalId(),
        fileName: file.name,
        bytes,
        importedAt: new Date().toISOString(),
      }
      const next = entries.slice()
      next[flatIndexOf(position)] = { file: stored, pokemon }
      setEntries(next)
      setDirty(true)
      setBoxIndex(position.site)
      setSelected(position)
      setMessage(`${file.name} added. Save Camping Pokémon to keep it.`)
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : `Unable to import ${file.name}.`
      )
    }
  }

  const handleDiscard = () => {
    if (!selected || !selectedEntry) return
    const next = entries.slice()
    next[flatIndexOf(selected)] = null
    setEntries(next)
    setDirty(true)
    setSelected(null)
    setMessage(
      `${selectedEntry.file.fileName} removed. Save Camping Pokémon to make it permanent.`
    )
  }

  const handleSave = async () => {
    if (!campLoadedRef.current) {
      setMessage('Camping Pokémon have not loaded, so they cannot be saved.')
      return
    }
    try {
      await storage.saveCamp(
        GENERATION,
        campFromEntries(entries, unreadableRef.current)
      )
      setDirty(false)
      setMessage('Camping Pokémon saved.')
    } catch (cause) {
      // Unsaved changes stay on screen so the save can be retried.
      setMessage(storageErrorMessage(cause))
    }
  }

  const handleBack = () => {
    if (!confirmLeave()) {
      return
    }
    onUnsavedChangesChange?.(false)
    onBack()
  }

  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={handleBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">GBA Lodge · Camp Sites</p>
            <h1 className="camp-title">Camping Pokémon</h1>
            <p className="camp-page-subtitle">
              Pokémon staying at camp outside a game save.
            </p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        {adapterLoading && <p className="camp-status">Loading PKHeX...</p>}
        {adapterError && (
          <p className="camp-status">
            Failed to load PKHeX: {adapterError.message}
          </p>
        )}
        {loadingFiles && !adapterLoading && (
          <p className="camp-status">Loading local Pokémon...</p>
        )}

        {!adapterLoading && !adapterError && !loadingFiles && (
          <div className="camp-panel">
            {dirty && (
              <div className="camp-status camp-unsaved-status">
                <span>You have unsaved changes.</span>
                <button
                  type="button"
                  className="camp-save-btn"
                  disabled={offline}
                  onClick={() => void handleSave()}
                >
                  Save Camping Pokémon
                </button>
              </div>
            )}
            {offline && (
              <p className="camp-status">
                Dropbox is unreachable. Saving is paused until it reconnects.
              </p>
            )}
            {message && <p className="camp-status">{message}</p>}
            <div className="camp-storage-layout">
              <section className="camp-storage-left">
                <div className="camp-storage-nav">
                  <button
                    type="button"
                    className="camp-nav-btn"
                    onClick={() => cycleBox(-1)}
                    aria-label="Previous Camp Site"
                  >
                    ←
                  </button>
                  <strong className="camp-box-label">
                    <span className="camp-location-kicker">
                      Camp Site {boxIndex + 1} of {boxCount}
                    </span>
                    <span className="camp-location-name">
                      {visibleEntries.filter(Boolean).length}/{CAMP_SITE_SIZE}{' '}
                      campers
                    </span>
                  </strong>
                  <button
                    type="button"
                    className="camp-nav-btn"
                    onClick={() => cycleBox(1)}
                    aria-label="Next Camp Site"
                  >
                    →
                  </button>
                </div>
                <div className="camp-panel camp-storage-grid-panel">
                  <div className="camp-local-grid">
                    {visibleEntries.map((entry, visibleSlot) => {
                      const position = positionOf(
                        boxIndex * CAMP_SITE_SIZE + visibleSlot
                      )
                      return (
                        <PokemonSlotIcon
                          key={`${position.site}-${position.index}`}
                          slot={entry?.pokemon ?? null}
                          resolver={resolver}
                          selected={isSamePosition(position, selected)}
                          onClick={() => setSelected(entry ? position : null)}
                        />
                      )
                    })}
                  </div>
                </div>
              </section>

              <section className="camp-storage-right camp-storage-right--details">
                {selectedEntry ? (
                  <>
                    <PokemonDetails
                      pokemon={selectedEntry.pokemon}
                      resolver={resolver}
                    />
                    <p className="camp-local-filename">
                      {selectedEntry.file.fileName}
                    </p>
                  </>
                ) : (
                  <div className="camp-panel camp-details-empty">
                    Choose a camper to view their details.
                  </div>
                )}
              </section>
            </div>

            <div className="camp-backup-actions">
              <span className="camp-backup-actions-left">
                {selectedEntry && (
                  <button
                    type="button"
                    className="camp-upload-btn camp-danger-btn"
                    onClick={handleDiscard}
                  >
                    Release
                  </button>
                )}
                <label className="camp-upload-btn">
                  Import .pk3
                  <input
                    className="camp-file-input--hidden"
                    type="file"
                    accept={FILE_EXTENSION}
                    onChange={handleImport}
                    disabled={!adapter || adapterLoading}
                  />
                </label>
              </span>
              {selectedEntry && (
                <button
                  type="button"
                  className="camp-upload-btn"
                  onClick={() => downloadPokemon(selectedEntry)}
                >
                  Download
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
