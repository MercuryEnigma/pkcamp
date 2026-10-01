import { useEffect, useMemo, useRef, useState } from 'react'
import type { BoxLocation, PokemonNode, SaveGame } from '../../services/pkhex'
import { saveLibrary, type Gen3GameId } from '../../services/saveLibrary'
import {
  esp32TradeDevice,
  type TradeDeviceEvent,
} from '../../services/tradeDevice'
import { initializeSpriteResolver } from '../../services/sprites'
import { usePkHex } from '../context/PkHexProvider'
import { GAME_LABEL } from './gameDisplay'
import { PokemonDetails } from './PokemonDetails'
import { PokemonSlotIcon } from './PokemonSlotIcon'
import { getStoredSpriteSourceId } from './spritePreference'
import { DEFAULT_SPRITE_SOURCE_ID, SPRITE_SOURCES } from './spriteSources'

const MAX_KEYS_SIZE = 1024 * 1024

function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function tradeStatus(event: TradeDeviceEvent): string | null {
  switch (event.type) {
    case 'status':
      return event.message
    case 'device':
      return `ESP32 connected${event.firmware ? ` · firmware ${event.firmware}` : ''}.`
    case 'opponent-party':
      return `Connected to ${event.name}.`
    case 'menu-open':
      return 'Trade menu open. Offering your selected Pokémon…'
    case 'offer':
      return event.accepted
        ? 'Offer sent. Choose a Pokémon on the Switch.'
        : 'The selected Pokémon could not be offered.'
    case 'trade-started':
      return 'Trade in progress…'
    case 'trade-completed':
      return 'Trade complete. Leave the room on the Switch to finish.'
    case 'room':
      return event.trades > 0
        ? 'Back in the trade room. Leave the room on the Switch to finish.'
        : null
    default:
      return null
  }
}

export function TradeSaveView({
  gameId,
  onBack,
  onReturnToLodge,
  onManageBackup,
}: {
  gameId: Gen3GameId
  onBack: () => void
  onReturnToLodge: () => void
  onManageBackup: () => void
}) {
  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const [game, setGame] = useState<SaveGame | null>(null)
  const [loadingBackup, setLoadingBackup] = useState(true)
  const [boxIndex, setBoxIndex] = useState(0)
  const [selectedLocation, setSelectedLocation] = useState<BoxLocation | null>(
    null
  )
  const [pendingLocation, setPendingLocation] = useState<BoxLocation | null>(
    null
  )
  const [revision, setRevision] = useState(0)
  const [needsKeys, setNeedsKeys] = useState(false)
  const [busy, setBusy] = useState(false)
  // Empty by default -- the header subtitle already explains what to do.
  // This is reserved for live ESP32/trade status once something's actually
  // happening (connecting, trade in progress, errors), not restated instructions.
  const [message, setMessage] = useState('')
  const operationAbortRef = useRef<AbortController | null>(null)
  const gameRef = useRef<SaveGame | null>(null)

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

    void saveLibrary
      .whenReady()
      .then(() => {
        if (cancelled) return
        const bytes = saveLibrary.getSave(gameId)
        if (!bytes) {
          setGame((previous) => {
            previous?.dispose()
            return null
          })
          return
        }
        const loaded = adapter.load(bytes)
        if (cancelled) {
          loaded.dispose()
          return
        }
        setGame((previous) => {
          previous?.dispose()
          return loaded
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setMessage(
            `The saved backup could not be opened: ${describeError(cause)}`
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBackup(false)
      })

    return () => {
      cancelled = true
    }
  }, [adapter, gameId])

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    return () => {
      operationAbortRef.current?.abort()
      esp32TradeDevice.cancelTrade()
      void esp32TradeDevice.disconnect()
      gameRef.current?.dispose()
    }
  }, [])

  const box = game?.boxes[boxIndex] ?? null
  const selected =
    game && selectedLocation
      ? (game.boxes[selectedLocation.box]?.slots[selectedLocation.slot] ?? null)
      : null

  const companionFor = (location: BoxLocation): PokemonNode | null => {
    if (!game) return null
    for (const [candidateBox, candidate] of game.boxes.entries()) {
      for (const [candidateSlot, pokemon] of candidate.slots.entries()) {
        if (
          pokemon &&
          (candidateBox !== location.box || candidateSlot !== location.slot)
        ) {
          return pokemon
        }
      }
    }
    return game.party.find((pokemon) => pokemon !== null) ?? null
  }

  const cycleBox = (delta: number) => {
    if (!game || game.boxes.length === 0) return
    setBoxIndex(
      (current) => (current + delta + game.boxes.length) % game.boxes.length
    )
  }

  const selectedCompanion = selectedLocation
    ? companionFor(selectedLocation)
    : null

  const handleBackupUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !adapter) return

    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const loaded = adapter.load(bytes)
      saveLibrary.updateSave(gameId, bytes)
      setGame((previous) => {
        previous?.dispose()
        return loaded
      })
      setBoxIndex(0)
      setSelectedLocation(null)
      setMessage(
        `${GAME_LABEL[gameId]} backup saved. Select a Pokémon to trade.`
      )
    } catch (cause) {
      setMessage(describeError(cause))
    }
  }

  const replaceTradedPokemon = async (
    location: BoxLocation,
    received: Uint8Array
  ): Promise<void> => {
    if (!adapter || !game) return
    const pokemon = adapter.importPokemonFile(received)
    game.setBoxSlot(location, pokemon)
    saveLibrary.updateSave(gameId, game.toBytes())
    setRevision((value) => value + 1)
    setSelectedLocation({ ...location })
    setMessage(
      `Trade complete. ${pokemon.nickname || `Pokémon #${pokemon.species}`} was saved to ${GAME_LABEL[gameId]}.`
    )
  }

  const runTrade = async (
    location: BoxLocation,
    signal: AbortSignal
  ): Promise<void> => {
    if (!adapter || !game) return
    const offered = game.boxes[location.box]?.slots[location.slot] ?? null
    const companion = companionFor(location)
    if (!offered || !companion) {
      throw new Error('Two Pokémon are required to enter a trade.')
    }

    let received: Uint8Array | null = null
    let failure: unknown = null
    try {
      const result = await esp32TradeDevice.trade({
        party: [
          adapter.exportPokemonFile(offered),
          adapter.exportPokemonFile(companion),
          null,
          null,
          null,
          null,
        ],
        selectedSlot: 0,
        signal,
        onEvent: (event) => {
          const status = tradeStatus(event)
          if (status) setMessage(status)
          if (event.type === 'trade-completed') received = event.received
        },
      })
      received ??= result.trades.at(-1)?.received ?? null
    } catch (cause) {
      failure = cause
    }

    if (received) {
      await replaceTradedPokemon(location, received)
      return
    }
    if (failure) throw failure
    setMessage('The room closed without completing a trade.')
  }

  const prepareTrade = async (location: BoxLocation): Promise<void> => {
    const controller = new AbortController()
    operationAbortRef.current = controller
    setBusy(true)
    setNeedsKeys(false)
    setPendingLocation({ ...location })
    try {
      if (!esp32TradeDevice.supported) {
        throw new Error('Trading requires a desktop browser with Web Serial.')
      }
      if (esp32TradeDevice.state === 'disconnected') {
        setMessage('Choose the USB port for your ESP32.')
        await esp32TradeDevice.connect()
      }
      controller.signal.throwIfAborted()
      setMessage('Checking the ESP32 firmware and Switch keys…')
      const keys = await esp32TradeDevice.keyStatus()
      controller.signal.throwIfAborted()
      if (!keys?.complete) {
        setNeedsKeys(true)
        setMessage('This ESP32 needs prod.keys from your Switch.')
        return
      }
      await runTrade(location, controller.signal)
    } catch (cause) {
      setMessage(
        controller.signal.aborted ? 'Trade cancelled.' : describeError(cause)
      )
    } finally {
      if (operationAbortRef.current === controller) {
        operationAbortRef.current = null
      }
      setBusy(false)
    }
  }

  const confirmTrade = () => {
    if (!selected || !selectedLocation || busy) return
    const name = selected.nickname || `Pokémon #${selected.species}`
    if (!window.confirm(`Trade ${name} with FireRed or LeafGreen on Switch?`)) {
      return
    }
    void prepareTrade(selectedLocation)
  }

  const uploadProdKeys = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_KEYS_SIZE) {
      setMessage('That file is too large to be prod.keys.')
      return
    }
    if (!pendingLocation) {
      setMessage('Select the Pokémon again before continuing.')
      return
    }

    const controller = new AbortController()
    operationAbortRef.current = controller
    setBusy(true)
    try {
      setMessage('Storing the required keys on the ESP32…')
      await esp32TradeDevice.storeProdKeys(await file.text())
      controller.signal.throwIfAborted()
      setNeedsKeys(false)
      setMessage('Keys stored. Looking for the Switch trade room…')
      await runTrade(pendingLocation, controller.signal)
    } catch (cause) {
      setMessage(
        controller.signal.aborted ? 'Trade cancelled.' : describeError(cause)
      )
    } finally {
      if (operationAbortRef.current === controller) {
        operationAbortRef.current = null
      }
      setBusy(false)
    }
  }

  const cancelActiveTrade = () => {
    operationAbortRef.current?.abort()
    esp32TradeDevice.cancelTrade()
    setMessage('Cancelling trade…')
  }

  const handleBack = () => {
    if (busy && !window.confirm('Cancel the active trade and go back?')) return
    operationAbortRef.current?.abort()
    esp32TradeDevice.cancelTrade()
    void esp32TradeDevice.disconnect()
    onBack()
  }

  const handleReturnToLodge = () => {
    if (busy && !window.confirm('Cancel the active trade and switch pages?')) {
      return
    }
    operationAbortRef.current?.abort()
    esp32TradeDevice.cancelTrade()
    void esp32TradeDevice.disconnect()
    onReturnToLodge()
  }

  const handleManageBackup = () => {
    if (
      busy &&
      !window.confirm('Cancel the active trade and visit the Camp Office?')
    ) {
      return
    }
    operationAbortRef.current?.abort()
    esp32TradeDevice.cancelTrade()
    void esp32TradeDevice.disconnect()
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
            <p className="camp-eyebrow">Trading Post · GBA Lodge</p>
            <h1 className="camp-title">{GAME_LABEL[gameId]} Cabin</h1>
            <p className="camp-page-subtitle">
              Choose a Pokémon from one of this Cabin&apos;s Rooms.
            </p>
          </div>
          <button
            type="button"
            className="camp-back camp-page-action"
            onClick={handleReturnToLodge}
          >
            Lodges →
          </button>
        </header>

        {adapterLoading && <p className="camp-status">Loading PKHeX...</p>}
        {adapterError && (
          <p className="camp-status">
            Failed to load PKHeX: {adapterError.message}
          </p>
        )}
        {loadingBackup && !adapterLoading && (
          <p className="camp-status">Loading backup…</p>
        )}

        {!adapterLoading && !adapterError && !loadingBackup && (
          <div className="camp-panel">
            {!game ? (
              <div className="camp-upload-empty">
                <p>No backup saved for {GAME_LABEL[gameId]}.</p>
                <label className="camp-upload-btn camp-upload-btn--primary">
                  Upload backup
                  <input
                    className="camp-file-input--hidden"
                    type="file"
                    accept=".sav"
                    onChange={handleBackupUpload}
                  />
                </label>
                {message && (
                  <p className="camp-status" aria-live="polite">
                    {message}
                  </p>
                )}
              </div>
            ) : (
              <>
                {message && (
                  <p className="camp-status" aria-live="polite">
                    {message}
                  </p>
                )}

                {needsKeys && (
                  <div className="camp-trade-setup">
                    <strong>Switch keys required</strong>
                    <p>
                      Choose <code>prod.keys</code> from your own Switch. The
                      keys are sent only to the connected ESP32.
                    </p>
                    <label className="camp-upload-btn camp-upload-btn--primary">
                      Choose prod.keys
                      <input
                        className="camp-file-input--hidden"
                        type="file"
                        accept=".keys,.txt"
                        onChange={uploadProdKeys}
                        disabled={busy}
                      />
                    </label>
                  </div>
                )}

                <div className="camp-storage-layout camp-storage-layout--save">
                  <section className="camp-storage-left">
                    <div className="camp-storage-nav">
                      <button
                        type="button"
                        className="camp-nav-btn"
                        onClick={() => cycleBox(-1)}
                        disabled={busy}
                        aria-label="Previous Room"
                      >
                        ←
                      </button>
                      <strong className="camp-box-label">
                        <span className="camp-location-kicker">
                          Room {boxIndex + 1} of {game.boxes.length}
                        </span>
                        <span className="camp-location-name">
                          {box?.name ?? `Box ${boxIndex + 1}`} ·{' '}
                          {box?.slots.filter(Boolean).length ?? 0}/
                          {box?.slots.length ?? 30} campers
                        </span>
                      </strong>
                      <button
                        type="button"
                        className="camp-nav-btn"
                        onClick={() => cycleBox(1)}
                        disabled={busy}
                        aria-label="Next Room"
                      >
                        →
                      </button>
                    </div>
                    <div className="camp-panel camp-storage-grid-panel">
                      <div className="camp-local-grid">
                        {box?.slots.map((pokemon, slot) => (
                          <PokemonSlotIcon
                            key={`${boxIndex}-${slot}-${revision}`}
                            slot={pokemon}
                            resolver={resolver}
                            selected={
                              selectedLocation?.box === boxIndex &&
                              selectedLocation.slot === slot
                            }
                            onClick={() => {
                              if (busy) return
                              setSelectedLocation(
                                pokemon ? { box: boxIndex, slot } : null
                              )
                              setNeedsKeys(false)
                              setPendingLocation(null)
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </section>

                  <section className="camp-storage-right camp-storage-right--details">
                    {selected ? (
                      <>
                        <PokemonDetails
                          pokemon={selected}
                          resolver={resolver}
                        />
                        {busy ? (
                          <button
                            type="button"
                            className="camp-upload-btn camp-danger-btn camp-trade-confirm"
                            onClick={cancelActiveTrade}
                          >
                            Cancel trade
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="camp-save-btn camp-trade-confirm"
                            onClick={confirmTrade}
                            disabled={!selectedLocation || !selectedCompanion}
                          >
                            Trade this Pokémon
                          </button>
                        )}
                        {selectedLocation && !selectedCompanion && (
                          <p className="camp-local-filename">
                            A second Pokémon is required before trading.
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="camp-panel camp-details-empty">
                        Choose a Pokémon from this Room to trade.
                      </div>
                    )}
                  </section>
                </div>

                {!busy && (
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
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
