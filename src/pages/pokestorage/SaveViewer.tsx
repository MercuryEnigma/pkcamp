import { useEffect, useRef, useState } from 'react'
import { localPokemonLibrary } from '../../services/localPokemonLibrary'
import type { PokemonNode, SaveGame } from '../../services/pkhex'
import { saveLibrary, type Gen3GameId } from '../../services/saveLibrary'
import { usePkHex } from '../context/PkHexProvider'
import { GAME_LABEL } from './gameDisplay'
import {
  CAMPING_POKEMON_BOX_SIZE,
  getStoredCampingBoxCount,
  resizeCampingSlots,
} from './campingStoragePreference'
import {
  PokemonStorageView,
  type CampingPokemonSlot,
} from './PokemonStorageView'

const GENERATION = 3 as const

function downloadPokemonFile(pokemon: PokemonNode, bytes: Uint8Array): void {
  const base = (pokemon.nickname || `pokemon-${pokemon.species}`)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const blob = new Blob([bytes.slice()], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${base || `pokemon-${pokemon.species}`}.pk3`
  anchor.click()
  URL.revokeObjectURL(url)
}

export function SaveViewer({
  gameId,
  onBack,
  onTrade,
  onUnsavedChangesChange,
}: {
  gameId: Gen3GameId
  onBack: () => void
  onTrade: () => void
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  const { adapter, loading, error } = usePkHex()
  const [game, setGame] = useState<SaveGame | null>(null)
  const [gameDirty, setGameDirty] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [localDirty, setLocalDirty] = useState(false)
  const [localSlots, setLocalSlots] = useState<(CampingPokemonSlot | null)[]>(
    () =>
      new Array<null>(
        getStoredCampingBoxCount(GENERATION) * CAMPING_POKEMON_BOX_SIZE
      ).fill(null)
  )
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonNode | null>(
    null
  )
  const loadedBytesRef = useRef<Uint8Array | null>(null)
  const hasUnsavedChanges = gameDirty || localDirty

  // Restore a previously persisted save for this game as soon as the adapter
  // is ready. Without this, IndexedDB persistence is invisible — bytes get
  // written on load but nothing ever reads them back.
  useEffect(() => {
    if (!adapter) return
    let cancelled = false

    void saveLibrary.whenReady().then(() => {
      if (cancelled) return
      const stored = saveLibrary.getSave(gameId)
      if (!stored) return
      try {
        loadedBytesRef.current = stored
        const restored = adapter.load(stored)
        if (cancelled) {
          restored.dispose()
          return
        }
        setGame((previous) => {
          previous?.dispose()
          return restored
        })
      } catch (err) {
        // A previously-stored save that no longer parses (e.g. adapter
        // changed) shouldn't crash the page — just fall back to the empty,
        // manual-upload state.
        console.error('Failed to restore stored save for', gameId, err)
        setUploadError(
          'Your stored backup could not be opened. Upload a new one.'
        )
      }
    })

    return () => {
      cancelled = true
    }
  }, [adapter, gameId])

  // Fast Refresh can preserve a SaveGame created before the movement methods
  // were added. Rehydrate that stale object from the persisted source bytes so
  // the UI always receives the current adapter contract without requiring a
  // manual hard refresh.
  useEffect(() => {
    if (
      !adapter ||
      !game ||
      (typeof game.movePokemon === 'function' &&
        typeof game.setBoxSlot === 'function')
    )
      return
    const loadedBytes = loadedBytesRef.current
    if (!loadedBytes) return
    const refreshed = adapter.load(loadedBytes)
    if (
      typeof refreshed.movePokemon !== 'function' ||
      typeof refreshed.setBoxSlot !== 'function'
    ) {
      refreshed.dispose()
      return
    }
    game.dispose()
    setGame(refreshed)
  }, [adapter, game, gameId])

  useEffect(() => {
    if (!adapter) return
    let cancelled = false
    setLocalLoading(true)
    localPokemonLibrary
      .getSlots(GENERATION)
      .then((files) => {
        if (cancelled) return
        const slots = files.map((file) => {
          if (file === null) return null
          return { file, pokemon: adapter.importPokemonFile(file.bytes) }
        })
        setLocalSlots(
          resizeCampingSlots(slots, getStoredCampingBoxCount(GENERATION))
        )
        setLocalError(null)
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLocalError(cause instanceof Error ? cause.message : String(cause))
        }
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [adapter])

  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges)
  }, [hasUnsavedChanges, onUnsavedChangesChange])

  useEffect(() => {
    return () => onUnsavedChangesChange?.(false)
  }, [onUnsavedChangesChange])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedChanges])

  // Release WASM-side state when leaving this game, not just when replacing
  // it with a new upload.
  const gameRef = useRef<SaveGame | null>(null)
  gameRef.current = game
  useEffect(() => {
    return () => {
      gameRef.current?.dispose()
    }
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !adapter) return

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const save = adapter.load(bytes)
      loadedBytesRef.current = bytes
      setGameDirty(true)
      setUploadError(null)
      // Release the previously loaded save's WASM-side state before replacing it.
      setGame((previous) => {
        previous?.dispose()
        return save
      })
    } catch (cause) {
      setUploadError(
        cause instanceof Error
          ? cause.message
          : 'Unable to open this save file.'
      )
    } finally {
      // Let the same file be selected again after a failed or cancelled edit.
      e.target.value = ''
    }
  }

  const handleSave = () => {
    if (!game) return
    const bytes = game.toBytes()
    saveLibrary.updateSave(gameId, bytes)
    loadedBytesRef.current = bytes
    setGameDirty(false)
  }

  const handleSaveLocal = async () => {
    try {
      await localPokemonLibrary.saveSlots(
        GENERATION,
        localSlots.map((entry) => entry?.file ?? null)
      )
      setLocalDirty(false)
      setLocalError(null)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const handleRemoveBackup = () => {
    if (
      !window.confirm(
        `Remove the saved backup for ${GAME_LABEL[gameId]}? This cannot be undone.`
      )
    )
      return
    saveLibrary.discardSave(gameId)
    loadedBytesRef.current = null
    setGameDirty(false)
    setSelectedPokemon(null)
    setGame((previous) => {
      previous?.dispose()
      return null
    })
  }

  const handleExportBackup = () => {
    if (!game) return
    const bytes = game.toBytes()
    const blob = new Blob([bytes.slice()], {
      type: 'application/octet-stream',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${gameId}.sav`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleBack = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
      return
    }
    onUnsavedChangesChange?.(false)
    onBack()
  }

  const handleTrade = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
      return
    }
    onUnsavedChangesChange?.(false)
    onTrade()
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
            <h1 className="camp-title">{GAME_LABEL[gameId]}</h1>
          </div>
          <button
            type="button"
            className="camp-back camp-page-action"
            onClick={handleTrade}
          >
            Trade →
          </button>
        </header>

        {loading && <p className="camp-status">Loading PKHeX...</p>}
        {error && (
          <p className="camp-status">Failed to load PKHeX: {error.message}</p>
        )}
        {localError && (
          <p className="camp-status">Camping Pokémon: {localError}</p>
        )}
        {uploadError && <p className="camp-status">{uploadError}</p>}

        {!loading && !error && (
          <div className="camp-panel">
            {!game && (
              <div className="camp-upload-empty">
                <p>No backup saved for {GAME_LABEL[gameId]}.</p>
                <label className="camp-upload-btn camp-upload-btn--primary">
                  Upload backup
                  <input
                    className="camp-file-input--hidden"
                    type="file"
                    accept=".sav"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            )}
            {game &&
              (typeof game.movePokemon !== 'function' ||
                typeof game.setBoxSlot !== 'function') && (
                <p className="camp-status">Refreshing Pokémon Storage…</p>
              )}
            {game &&
              typeof game.movePokemon === 'function' &&
              typeof game.setBoxSlot === 'function' && (
                <>
                  {hasUnsavedChanges && (
                    <div className="camp-status camp-unsaved-status">
                      <span>You have unsaved changes.</span>
                      <span className="camp-save-actions">
                        {gameDirty && (
                          <button
                            type="button"
                            className="camp-save-btn"
                            onClick={handleSave}
                          >
                            Save Game
                          </button>
                        )}
                        {localDirty && (
                          <button
                            type="button"
                            className="camp-save-btn"
                            onClick={handleSaveLocal}
                          >
                            Save Camping Pokémon
                          </button>
                        )}
                      </span>
                    </div>
                  )}
                  <PokemonStorageView
                    game={game}
                    localSlots={localSlots}
                    localLoading={localLoading}
                    exportPokemonFile={(pokemon) =>
                      adapter!.exportPokemonFile(pokemon)
                    }
                    onGameChange={() => setGameDirty(true)}
                    onLocalChange={(slots) => {
                      setLocalSlots(slots)
                      setLocalDirty(true)
                    }}
                    onSelectedChange={setSelectedPokemon}
                  />
                  <div className="camp-backup-actions">
                    <span className="camp-backup-actions-left">
                      <button
                        type="button"
                        className="camp-upload-btn camp-danger-btn"
                        onClick={handleRemoveBackup}
                      >
                        Remove backup
                      </button>
                      <label className="camp-upload-btn">
                        Replace backup
                        <input
                          className="camp-file-input--hidden"
                          type="file"
                          accept=".sav"
                          onChange={handleFileUpload}
                        />
                      </label>
                      <button
                        type="button"
                        className="camp-upload-btn"
                        onClick={handleExportBackup}
                      >
                        Export backup
                      </button>
                    </span>
                    {selectedPokemon && (
                      <button
                        type="button"
                        className="camp-upload-btn"
                        onClick={() =>
                          downloadPokemonFile(
                            selectedPokemon,
                            adapter!.exportPokemonFile(selectedPokemon)
                          )
                        }
                      >
                        Download
                      </button>
                    )}
                  </div>
                </>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
