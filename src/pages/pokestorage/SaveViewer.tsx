import { useCallback, useEffect, useRef, useState } from 'react'
import type { PokemonNode, SaveGame } from '../../services/pkhex'
import type { Gen3GameId } from '../../services/saveLibrary'
import {
  DEFAULT_CAMP_SITE_COUNT,
  storage,
  type CampPokemon,
} from '../../services/storage'
import { usePkHex } from '../context/PkHexContext'
import { GAME_LABEL } from './gameDisplay'
import { GbaSavePanel } from './GbaSavePanel'
import { assertSaveMatchesCabin } from './saveVersion'
import {
  CAMP_SITE_SIZE,
  campFromEntries,
  loadCampEntries,
} from './campPositions'
import {
  storageErrorMessage,
  useStorageOffline,
  useStorageProvider,
} from './useStorage'
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
  onManageBackup,
  onUnsavedChangesChange,
  initialBox,
}: {
  gameId: Gen3GameId
  onBack: () => void
  /** Receives the open box so the Trading Post can show it too. */
  onTrade: (box?: number) => void
  initialBox?: number
  onManageBackup: () => void
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  const { adapter, loading, error } = usePkHex()
  const { provider, ready } = useStorageProvider()
  const offline = useStorageOffline()
  const [game, setGame] = useState<SaveGame | null>(null)
  const [gameDirty, setGameDirty] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [readingFromGba, setReadingFromGba] = useState(false)
  const [localDirty, setLocalDirty] = useState(false)
  const [localSlots, setLocalSlots] = useState<(CampingPokemonSlot | null)[]>(
    () => new Array<null>(DEFAULT_CAMP_SITE_COUNT * CAMP_SITE_SIZE).fill(null)
  )
  const [localLoading, setLocalLoading] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [selectedPokemon, setSelectedPokemon] = useState<PokemonNode | null>(
    null
  )
  const loadedBytesRef = useRef<Uint8Array | null>(null)
  const campLoadedRef = useRef(false)
  const unreadableCampRef = useRef<ReadonlyMap<number, CampPokemon>>(new Map())
  const boxRef = useRef<number | null>(initialBox ?? null)
  const hasUnsavedChanges = gameDirty || localDirty

  // Restore a previously stored save for this game as soon as the adapter
  // and the active storage are ready, and again if the storage changes.
  useEffect(() => {
    if (!adapter || !ready) return
    let cancelled = false

    provider
      .getSave(gameId)
      .then((stored) => {
        if (cancelled) return
        if (!stored) {
          setGame((previous) => {
            previous?.dispose()
            return null
          })
          setGameDirty(false)
          return
        }
        let restored: SaveGame | null = null
        try {
          loadedBytesRef.current = stored.bytes
          restored = adapter.load(stored.bytes)
          assertSaveMatchesCabin(gameId, restored)
          if (cancelled) {
            restored.dispose()
            return
          }
          setGame((previous) => {
            previous?.dispose()
            return restored
          })
          setGameDirty(false)
          setUploadError(null)
        } catch (err) {
          restored?.dispose()
          // A previously-stored save that no longer parses (e.g. adapter
          // changed) shouldn't crash the page — just fall back to the empty,
          // manual-upload state.
          console.error('Failed to restore stored save for', gameId, err)
          setUploadError(
            'Your stored backup could not be opened. Upload a new one.'
          )
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setUploadError(storageErrorMessage(cause))
      })

    return () => {
      cancelled = true
    }
  }, [adapter, gameId, provider, ready])

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
    if (!adapter || !ready) return
    let cancelled = false
    campLoadedRef.current = false
    provider
      .getCamp(GENERATION)
      .then((camp) => {
        if (cancelled) return
        const loaded = loadCampEntries(camp, adapter)
        unreadableCampRef.current = loaded.unreadable
        campLoadedRef.current = true
        setLocalSlots(loaded.entries)
        setLocalDirty(false)
        setLocalError(
          loaded.unreadable.size > 0
            ? `${loaded.unreadable.size} stored Pokémon file${loaded.unreadable.size === 1 ? '' : 's'} could not be read.`
            : null
        )
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLocalError(storageErrorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLocalLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [adapter, provider, ready])

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
  useEffect(() => {
    gameRef.current = game
  }, [game])
  useEffect(() => {
    return () => {
      gameRef.current?.dispose()
    }
  }, [])

  /** Opens `bytes` as an unsaved backup, as an upload does. */
  const loadBackup = (bytes: Uint8Array) => {
    if (!adapter) return
    const save = adapter.load(bytes)
    try {
      assertSaveMatchesCabin(gameId, save)
    } catch (cause) {
      save.dispose()
      throw cause
    }
    loadedBytesRef.current = bytes
    setGameDirty(true)
    setUploadError(null)
    // Release the previously loaded save's WASM-side state before replacing it.
    setGame((previous) => {
      previous?.dispose()
      return save
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !adapter) return

    try {
      loadBackup(new Uint8Array(await file.arrayBuffer()))
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

  const handleSave = async () => {
    if (!game) return
    const bytes = game.toBytes()
    try {
      await storage.putSave(gameId, bytes)
      loadedBytesRef.current = bytes
      setGameDirty(false)
      setUploadError(null)
    } catch (cause) {
      // Unsaved changes stay in the editor so the save can be retried.
      setUploadError(storageErrorMessage(cause))
    }
  }

  const handleSaveLocal = async () => {
    if (!campLoadedRef.current) {
      setLocalError('Camping Pokémon have not loaded, so they cannot be saved.')
      return
    }
    try {
      await storage.saveCamp(
        GENERATION,
        campFromEntries(localSlots, unreadableCampRef.current)
      )
      setLocalDirty(false)
      setLocalError(null)
    } catch (cause) {
      setLocalError(storageErrorMessage(cause))
    }
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

  const handleBoxChange = useCallback((box: number | null) => {
    boxRef.current = box
  }, [])

  const handleTrade = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
      return
    }
    onUnsavedChangesChange?.(false)
    onTrade(boxRef.current ?? undefined)
  }

  const handleManageBackup = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
      return
    }
    onUnsavedChangesChange?.(false)
    onManageBackup()
  }

  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={handleBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">GBA Lodge · Game Cabin</p>
            <h1 className="camp-title">{GAME_LABEL[gameId]} Cabin</h1>
            <p className="camp-page-subtitle">Generation 3 game save</p>
          </div>
          <button
            type="button"
            className="camp-back camp-page-action"
            onClick={handleTrade}
          >
            Trading Post
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
        {offline && (
          <p className="camp-status">
            Dropbox is unreachable. Saving is paused until it reconnects.
          </p>
        )}

        {!loading && !error && (
          <div className="camp-panel">
            {!game && (
              <div className="camp-upload-empty">
                <p>No backup saved for {GAME_LABEL[gameId]}.</p>
                {readingFromGba ? (
                  <GbaSavePanel
                    mode="read"
                    gameId={gameId}
                    onSave={(bytes) => {
                      // Already stored by the panel, so it opens unchanged.
                      setReadingFromGba(false)
                      loadBackup(bytes)
                      setGameDirty(false)
                    }}
                    onClose={() => setReadingFromGba(false)}
                  />
                ) : (
                  <div className="camp-local-actions">
                    <label className="camp-upload-btn camp-upload-btn--primary">
                      Upload backup
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
                      onClick={() => setReadingFromGba(true)}
                    >
                      Backup from GBA
                    </button>
                  </div>
                )}
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
                            disabled={offline}
                            onClick={() => void handleSave()}
                          >
                            Save Game
                          </button>
                        )}
                        {localDirty && (
                          <button
                            type="button"
                            className="camp-save-btn"
                            disabled={offline}
                            onClick={() => void handleSaveLocal()}
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
                    initialBox={initialBox}
                    onBoxChange={handleBoxChange}
                  />
                  <div className="camp-backup-actions">
                    <span className="camp-backup-actions-left">
                      <button
                        type="button"
                        className="camp-upload-btn"
                        onClick={handleManageBackup}
                      >
                        Manage backup in Camp Office
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
