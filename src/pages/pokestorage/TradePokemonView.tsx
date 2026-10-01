import { useEffect, useMemo, useRef, useState } from 'react'
import {
  localPokemonLibrary,
  type StoredPokemonFile,
} from '../../services/localPokemonLibrary'
import type { PokemonNode } from '../../services/pkhex'
import {
  esp32TradeDevice,
  type TradeDeviceEvent,
} from '../../services/tradeDevice'
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
const MAX_KEYS_SIZE = 1024 * 1024

interface TradePokemonEntry {
  file: StoredPokemonFile
  pokemon: PokemonNode
}

function pokemonFileName(pokemon: PokemonNode): string {
  const base = (pokemon.nickname || `pokemon-${pokemon.species}`)
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return `${base || `pokemon-${pokemon.species}`}.pk3`
}

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

export function TradePokemonView({ onBack }: { onBack: () => void }) {
  const { adapter, loading: adapterLoading, error: adapterError } = usePkHex()
  const [entries, setEntries] = useState<(TradePokemonEntry | null)[]>(() =>
    new Array<null>(
      getStoredCampingBoxCount(GENERATION) * CAMPING_POKEMON_BOX_SIZE
    ).fill(null)
  )
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [boxIndex, setBoxIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingTradeId, setPendingTradeId] = useState<string | null>(null)
  const [needsKeys, setNeedsKeys] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Select a Camping Pokémon to trade.')
  const operationAbortRef = useRef<AbortController | null>(null)

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
        const readable = files.map((file) => {
          if (!file) return null
          try {
            return { file, pokemon: adapter.importPokemonFile(file.bytes) }
          } catch {
            return null
          }
        })
        setEntries(
          resizeCampingSlots(readable, getStoredCampingBoxCount(GENERATION))
        )
      })
      .catch((cause: unknown) => {
        if (!cancelled) setMessage(describeError(cause))
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false)
      })

    return () => {
      cancelled = true
    }
  }, [adapter])

  useEffect(() => {
    return () => {
      operationAbortRef.current?.abort()
      esp32TradeDevice.cancelTrade()
      void esp32TradeDevice.disconnect()
    }
  }, [])

  const selected =
    entries.find((entry) => entry?.file.id === selectedId) ?? null
  const occupied = entries.filter(Boolean).length
  const boxCount = entries.length / CAMPING_POKEMON_BOX_SIZE
  const visibleEntries = entries.slice(
    boxIndex * CAMPING_POKEMON_BOX_SIZE,
    (boxIndex + 1) * CAMPING_POKEMON_BOX_SIZE
  )

  const cycleBox = (delta: number) => {
    setBoxIndex((current) => (current + delta + boxCount) % boxCount)
  }

  const replaceTradedPokemon = async (
    entry: TradePokemonEntry,
    received: Uint8Array
  ): Promise<void> => {
    if (!adapter) return
    const pokemon = adapter.importPokemonFile(received)
    const next = entries.slice()
    next[entry.file.slot] = {
      pokemon,
      file: {
        ...entry.file,
        bytes: received.slice(),
        fileName: pokemonFileName(pokemon),
        importedAt: new Date().toISOString(),
      },
    }
    await localPokemonLibrary.saveSlots(
      GENERATION,
      next.map((item) => item?.file ?? null)
    )
    setEntries(next)
    setSelectedId(entry.file.id)
    setMessage(
      `Trade complete. ${pokemon.nickname || `Pokémon #${pokemon.species}`} has joined the camp site!`
    )
  }

  const runTrade = async (
    entry: TradePokemonEntry,
    signal: AbortSignal
  ): Promise<void> => {
    const companion = entries.find(
      (item): item is TradePokemonEntry =>
        item !== null && item.file.id !== entry.file.id
    )
    if (!companion) {
      throw new Error('Two Camping Pokémon are required to enter a trade.')
    }

    let received: Uint8Array | null = null
    let failure: unknown = null
    try {
      const result = await esp32TradeDevice.trade({
        party: [entry.file.bytes, companion.file.bytes, null, null, null, null],
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
      await replaceTradedPokemon(entry, received)
      return
    }
    if (failure) throw failure
    setMessage('The room closed without completing a trade.')
  }

  const prepareTrade = async (entry: TradePokemonEntry): Promise<void> => {
    const controller = new AbortController()
    operationAbortRef.current = controller
    setBusy(true)
    setNeedsKeys(false)
    setPendingTradeId(entry.file.id)
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
      await runTrade(entry, controller.signal)
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
    if (!selected || busy) return
    const name =
      selected.pokemon.nickname || `Pokémon #${selected.pokemon.species}`
    if (!window.confirm(`Trade ${name} with FireRed or LeafGreen on Switch?`)) {
      return
    }
    void prepareTrade(selected)
  }

  const uploadProdKeys = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_KEYS_SIZE) {
      setMessage('That file is too large to be prod.keys.')
      return
    }

    const entry = entries.find((item) => item?.file.id === pendingTradeId)
    if (!entry) {
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
      await runTrade(entry, controller.signal)
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

  return (
    <div className="camp-root">
      <div className="camp-content">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={handleBack}>
            ← Back
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Trade · Generation 3</p>
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
          <p className="camp-status">Loading Camping Pokémon…</p>
        )}

        {!adapterLoading && !adapterError && !loadingFiles && (
          <div className="camp-panel">
            <p className="camp-status" aria-live="polite">
              {message}
            </p>

            {needsKeys && (
              <div className="camp-trade-setup">
                <strong>Switch keys required</strong>
                <p>
                  Choose <code>prod.keys</code> from your own Switch. The keys
                  are sent only to the connected ESP32.
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

            <div className="camp-storage-layout">
              <section className="camp-storage-left">
                <div className="camp-storage-nav">
                  <button
                    type="button"
                    className="camp-nav-btn"
                    onClick={() => cycleBox(-1)}
                    disabled={busy}
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
                    disabled={busy}
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
                          onClick={() => {
                            if (!busy) {
                              setSelectedId(entry?.file.id ?? null)
                              setNeedsKeys(false)
                              setPendingTradeId(null)
                            }
                          }}
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
                        disabled={occupied < 2}
                      >
                        Trade this Pokémon
                      </button>
                    )}
                    {occupied < 2 && (
                      <p className="camp-local-filename">
                        Add a second Camping Pokémon before trading.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="camp-panel camp-details-empty">
                    Select a Pokémon to trade.
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
