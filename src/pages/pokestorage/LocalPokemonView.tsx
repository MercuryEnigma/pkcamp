import { useEffect, useMemo, useState } from 'react'
import type { PokemonNode } from '../../services/pkhex'
import {
  localPokemonLibrary,
  type StoredPokemonFile,
} from '../../services/localPokemonLibrary'
import { initializeSpriteResolver } from '../../services/sprites'
import { usePkHex } from '../context/PkHexProvider'
import { PokemonDetails } from './PokemonDetails'
import { PokemonSlotIcon } from './PokemonSlotIcon'
import {
  CAMPING_POKEMON_BOX_SIZE,
  getStoredCampingBoxCount,
  resizeCampingSlots,
} from './campingStoragePreference'
import { getStoredSpriteSourceId } from './spritePreference'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'

const GENERATION = 3 as const
const FILE_EXTENSION = '.pk3'

interface LocalPokemonEntry {
  file: StoredPokemonFile
  pokemon: PokemonNode
}

function downloadPokemon(entry: LocalPokemonEntry): void {
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
}: {
  onBack: () => void
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const [entries, setEntries] = useState<(LocalPokemonEntry | null)[]>(() =>
    new Array<null>(
      getStoredCampingBoxCount(GENERATION) * CAMPING_POKEMON_BOX_SIZE
    ).fill(null)
  )
  const [dirty, setDirty] = useState(false)
  const [boxIndex, setBoxIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  const resolver = useMemo(() => {
    const sourceId = getStoredSpriteSourceId() ?? DEFAULT_SPRITE_SOURCE_ID
    const source =
      SPRITE_SOURCES.find((item) => item.id === sourceId) ?? SPRITE_SOURCES[0]
    return initializeSpriteResolver({
      sourceId: source.id,
      manifest: source.manifest,
      formAliases: source.formAliases,
    })
  }, [])

  useEffect(() => {
    if (!adapter) return

    let cancelled = false

    localPokemonLibrary
      .getSlots(GENERATION)
      .then((files) => {
        if (cancelled) return
        const readable = new Array<LocalPokemonEntry | null>(files.length).fill(
          null
        )
        let unreadableCount = 0

        for (const [slot, file] of files.entries()) {
          if (file === null) continue
          try {
            readable[slot] = {
              file,
              pokemon: adapter.importPokemonFile(file.bytes),
            }
          } catch {
            unreadableCount += 1
          }
        }

        setEntries(
          resizeCampingSlots(readable, getStoredCampingBoxCount(GENERATION))
        )
        if (unreadableCount > 0) {
          setMessage(
            `${unreadableCount} stored Pokémon file${unreadableCount === 1 ? '' : 's'} could not be read.`
          )
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setMessage(cause instanceof Error ? cause.message : String(cause))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false)
      })

    return () => {
      cancelled = true
    }
  }, [adapter, adapterLoading])

  useEffect(() => {
    onUnsavedChangesChange?.(dirty)
  }, [dirty, onUnsavedChangesChange])

  useEffect(() => {
    return () => onUnsavedChangesChange?.(false)
  }, [onUnsavedChangesChange])

  useEffect(() => {
    if (!dirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [dirty])

  const selected =
    entries.find((entry) => entry?.file.id === selectedId) ?? null
  const boxCount = entries.length / CAMPING_POKEMON_BOX_SIZE
  const visibleEntries = entries.slice(
    boxIndex * CAMPING_POKEMON_BOX_SIZE,
    (boxIndex + 1) * CAMPING_POKEMON_BOX_SIZE
  )

  const cycleBox = (delta: number) => {
    setBoxIndex((current) => (current + delta + boxCount) % boxCount)
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter) return

    if (!file.name.toLowerCase().endsWith(FILE_EXTENSION)) {
      setMessage(`Choose a ${FILE_EXTENSION} file for the Gen 3 collection.`)
      return
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const pokemon = adapter.importPokemonFile(bytes)
      const slot = entries.indexOf(null)
      if (slot < 0) {
        throw new Error(
          'Camping Pokémon is full. Add another box in Poké Storage Settings.'
        )
      }
      const stored: StoredPokemonFile = {
        id: newLocalId(),
        slot,
        fileName: file.name,
        bytes,
        importedAt: new Date().toISOString(),
      }
      const next = entries.slice()
      next[slot] = { file: stored, pokemon }
      setEntries(next)
      setDirty(true)
      setBoxIndex(Math.floor(slot / CAMPING_POKEMON_BOX_SIZE))
      setSelectedId(stored.id)
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
    if (!selected) return
    const next = entries.slice()
    next[selected.file.slot] = null
    setEntries(next)
    setDirty(true)
    setSelectedId(null)
    setMessage(
      `${selected.file.fileName} removed. Save Camping Pokémon to make it permanent.`
    )
  }

  const handleSave = async () => {
    try {
      await localPokemonLibrary.saveSlots(
        GENERATION,
        entries.map((entry) => entry?.file ?? null)
      )
      setDirty(false)
      setMessage('Camping Pokémon saved.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const handleBack = () => {
    if (
      dirty &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
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
            <p className="camp-eyebrow">Generation 3</p>
            <h1 className="camp-title">Camping Pokémon</h1>
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
                  onClick={handleSave}
                >
                  Save Camping Pokémon
                </button>
              </div>
            )}
            {message && <p className="camp-status">{message}</p>}
            <div className="camp-storage-layout">
              <section className="camp-storage-left">
                <div className="camp-storage-nav">
                  <button
                    type="button"
                    className="camp-nav-btn"
                    onClick={() => cycleBox(-1)}
                    aria-label="Previous Camping Pokémon box"
                  >
                    ←
                  </button>
                  <strong className="camp-box-label">
                    Camping Box {boxIndex + 1} ({boxIndex + 1}/{boxCount})
                  </strong>
                  <button
                    type="button"
                    className="camp-nav-btn"
                    onClick={() => cycleBox(1)}
                    aria-label="Next Camping Pokémon box"
                  >
                    →
                  </button>
                </div>
                <div className="camp-panel camp-storage-grid-panel">
                  <div className="camp-local-grid">
                    {visibleEntries.map((entry, visibleSlot) => {
                      const slot =
                        boxIndex * CAMPING_POKEMON_BOX_SIZE + visibleSlot
                      return (
                        <PokemonSlotIcon
                          key={entry?.file.id ?? `empty-${slot}`}
                          slot={entry?.pokemon ?? null}
                          resolver={resolver}
                          selected={entry?.file.id === selectedId}
                          onClick={() => setSelectedId(entry?.file.id ?? null)}
                        />
                      )
                    })}
                  </div>
                </div>
              </section>

              <section className="camp-storage-right camp-storage-right--details">
                {selected ? (
                  <>
                    <PokemonDetails pokemon={selected.pokemon} />
                    <p className="camp-local-filename">
                      {selected.file.fileName}
                    </p>
                  </>
                ) : (
                  <div className="camp-panel camp-details-empty">
                    Select a Pokémon to view its details.
                  </div>
                )}
              </section>
            </div>

            <div className="camp-backup-actions">
              <span className="camp-backup-actions-left">
                {selected && (
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
              {selected && (
                <button
                  type="button"
                  className="camp-upload-btn"
                  onClick={() => downloadPokemon(selected)}
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
