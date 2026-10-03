import { useCallback, useEffect, useRef, useState } from 'react'
import ribbondolUrl from '../../assets/saves/ribbondol.pk3?url'
import type { Gen3GameId } from '../../services/saveLibrary'
import {
  esp32TradeDevice,
  gbLinkTradeDevice,
  revertTrade,
  runTrade,
  tradeAvailability,
  tradeSideKey,
  type TradeDeviceEvent,
  type TradeSide,
  type TradeWrite,
} from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexProvider'
import { GAME_LABEL } from './gameDisplay'
import { CampSelectionPanel, SaveSelectionPanel } from './TradeSelectionPanels'

const MAX_KEYS_SIZE = 1024 * 1024

const SAVE_IDS: readonly Gen3GameId[] = [
  'ruby',
  'sapphire',
  'emerald',
  'firered',
  'leafgreen',
]

/** Selectable sources. Selections are added once a Pokémon is picked. */
const SOURCE_OPTIONS: readonly { label: string; side: TradeSide }[] = [
  ...SAVE_IDS.map((gameId) => ({
    label: `${GAME_LABEL[gameId]} backup`,
    side: { device: 'save-backup', gameId } as TradeSide,
  })),
  { label: 'Camp Sites', side: { device: 'camp-site' } },
  { label: 'Game Boy Advance via GB-Link', side: { device: 'gb-link' } },
  { label: 'Switch via ESP32', side: { device: 'esp32' } },
]

type LocalSlot = NonNullable<
  Extract<TradeSide, { device: 'save-backup' | 'camp-site' }>['slot']
>

type SideName = 'left' | 'right'

function describeError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return 'Trade cancelled.'
  }
  return cause instanceof Error ? cause.message : String(cause)
}

function statusForEvent(event: TradeDeviceEvent): string | null {
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
    case 'hardware-trade-finished':
      return 'The Game Boy Advance finished the trade. Saving…'
    default:
      return null
  }
}

function clearSelection(side: TradeSide | null): TradeSide | null {
  if (side?.device === 'save-backup') {
    return { device: 'save-backup', gameId: side.gameId }
  }
  if (side?.device === 'camp-site') return { device: 'camp-site' }
  return side
}

function isReady(side: TradeSide | null, switchKeysReady: boolean): boolean {
  if (!side) return false
  if (side.device === 'save-backup' || side.device === 'camp-site') {
    return !!side.slot
  }
  if (side.device === 'esp32') {
    return esp32TradeDevice.state === 'connected' && switchKeysReady
  }
  return gbLinkTradeDevice.state === 'connected'
}

/** Connection and setup status for a hardware side. No Pokémon is chosen here. */
function DevicePanel({
  kind,
  disabled,
  keysReady,
  onKeysReady,
  onChange,
  onMessage,
}: {
  kind: 'gb-link' | 'esp32'
  disabled: boolean
  /** Whether the ESP32 holds complete Switch keys; null until checked. */
  keysReady: boolean | null
  onKeysReady: (ready: boolean | null) => void
  onChange: () => void
  onMessage: (message: string) => void
}) {
  const isGba = kind === 'gb-link'
  const device = isGba ? gbLinkTradeDevice : esp32TradeDevice
  const setKeysReady = onKeysReady
  const [working, setWorking] = useState(false)
  const connected = device.state !== 'disconnected'

  const run = async (action: () => Promise<void>) => {
    setWorking(true)
    try {
      await action()
    } catch (cause) {
      onMessage(describeError(cause))
    } finally {
      setWorking(false)
      onChange()
    }
  }

  const connect = () =>
    run(async () => {
      await device.connect()
      if (!isGba) {
        setKeysReady(Boolean((await esp32TradeDevice.keyStatus())?.complete))
      }
    })

  const disconnect = () =>
    run(async () => {
      await device.disconnect()
      setKeysReady(null)
    })

  const uploadProdKeys = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void run(async () => {
      if (file.size > MAX_KEYS_SIZE) {
        throw new Error('That file is too large to be prod.keys.')
      }
      onMessage('Storing the required keys on the ESP32…')
      await esp32TradeDevice.storeProdKeys(await file.text())
      setKeysReady(true)
      onMessage('Keys stored.')
    })
  }

  return (
    <div className="camp-trade-hardware">
      <strong>{isGba ? 'GB-Link' : 'ESP32'} connection</strong>
      <p>
        Choose the Pokémon on your {isGba ? 'Game Boy Advance' : 'Switch'}{' '}
        during the trade.
      </p>
      {device.supported ? (
        <>
          <span className="camp-trade-device-status">
            {device.state === 'disconnected'
              ? 'Not connected'
              : device.state === 'trading'
                ? 'Trading'
                : 'Connected'}
          </span>
          <div className="camp-local-actions">
            <button
              type="button"
              className="camp-upload-btn"
              disabled={disabled || working || device.state === 'trading'}
              onClick={() => void (connected ? disconnect() : connect())}
            >
              {connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        </>
      ) : (
        <span className="camp-trade-device-status camp-trade-device-status--warning">
          This browser does not support the required device connection
        </span>
      )}
      <p className="camp-trade-note">
        {isGba
          ? 'Connect the GB-Link to this computer and the link cable to the GBA.'
          : 'Connect the ESP32 by USB.'}
      </p>
      {!isGba && connected && keysReady === false && (
        <div className="camp-trade-setup">
          <strong>Switch keys required</strong>
          <p>
            Choose <code>prod.keys</code> from your own Switch. The keys are
            sent only to the connected ESP32.
          </p>
          <label className="camp-upload-btn camp-upload-btn--primary">
            Choose prod.keys
            <input
              className="camp-file-input--hidden"
              type="file"
              accept=".keys,.txt"
              disabled={disabled || working}
              onChange={uploadProdKeys}
            />
          </label>
        </div>
      )}
    </div>
  )
}

function SidePanel({
  name,
  value,
  initialBox,
  onBoxChange,
  other,
  reload,
  disabled,
  keysReady,
  onKeysReady,
  onSource,
  onSelection,
  onDeviceChange,
  onMessage,
}: {
  name: string
  value: TradeSide | null
  initialBox?: number
  onBoxChange?: (box: number) => void
  other: TradeSide | null
  reload: number
  disabled: boolean
  keysReady: boolean | null
  onKeysReady: (ready: boolean | null) => void
  onSource: (side: TradeSide | null) => void
  onSelection: (slot: LocalSlot) => void
  onDeviceChange: () => void
  onMessage: (message: string) => void
}) {
  return (
    <section className="camp-panel camp-trade-side">
      <label className="camp-trade-source-label">
        <span>{name}</span>
        <select
          className="camp-select camp-trade-source-select"
          value={value ? tradeSideKey(value) : ''}
          disabled={disabled}
          onChange={(event) =>
            onSource(
              SOURCE_OPTIONS.find(
                (option) => tradeSideKey(option.side) === event.target.value
              )?.side ?? null
            )
          }
        >
          <option value="">Choose a source…</option>
          {SOURCE_OPTIONS.map(({ label, side }) => {
            const availability = other ? tradeAvailability(side, other) : 'ok'
            return (
              <option
                key={tradeSideKey(side)}
                value={tradeSideKey(side)}
                disabled={availability !== 'ok'}
              >
                {availability === 'coming-soon'
                  ? `${label} (coming soon)`
                  : label}
              </option>
            )
          })}
        </select>
      </label>
      {!value && (
        <p className="camp-trade-note">
          Choose the game or storage source for this side.
        </p>
      )}
      {value?.device === 'save-backup' && (
        <SaveSelectionPanel
          key={value.gameId}
          gameId={value.gameId}
          initialBox={initialBox}
          onBoxChange={onBoxChange}
          reload={reload}
          onSelect={onSelection}
        />
      )}
      {value?.device === 'camp-site' && (
        <CampSelectionPanel reload={reload} onSelect={onSelection} />
      )}
      {(value?.device === 'gb-link' || value?.device === 'esp32') && (
        <DevicePanel
          key={value.device}
          kind={value.device}
          disabled={disabled}
          keysReady={keysReady}
          onKeysReady={onKeysReady}
          onChange={onDeviceChange}
          onMessage={onMessage}
        />
      )}
    </section>
  )
}

export function TradeView({
  onBack,
  initialGameId,
  initialBox,
}: {
  /** Receives the box open for `initialGameId`, to reopen in its Cabin. */
  onBack: (box?: number) => void
  initialGameId?: Gen3GameId
  /** Box to open for `initialGameId`, e.g. the one open in its Cabin. */
  initialBox?: number
}) {
  const [left, setLeft] = useState<TradeSide | null>(
    initialGameId ? { device: 'save-backup', gameId: initialGameId } : null
  )
  const [right, setRight] = useState<TradeSide | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Bumped after a completed trade so the selection panels reload their data
  // in place, keeping the box each side is viewing.
  const [reload, setReload] = useState(0)
  // Bumped after device connects so the Start button re-evaluates.
  const [, setDeviceRevision] = useState(0)
  const [switchKeysReady, setSwitchKeysReady] = useState<boolean | null>(null)
  // What the last trade overwrote in PkCamp, for "Revert trade".
  const [lastTrade, setLastTrade] = useState<TradeWrite[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { adapter } = usePkHex()

  useEffect(
    () => () => {
      abortRef.current?.abort()
      esp32TradeDevice.cancelTrade()
      gbLinkTradeDevice.cancelTrade()
      void esp32TradeDevice.disconnect()
      void gbLinkTradeDevice.disconnect()
    },
    []
  )

  const setSide = (
    name: SideName,
    update: (side: TradeSide | null) => TradeSide | null
  ) => {
    ;(name === 'left' ? setLeft : setRight)(update)
    setMessage(null)
  }

  const ready =
    left !== null &&
    right !== null &&
    adapter !== null &&
    tradeAvailability(left, right) === 'ok' &&
    isReady(left, switchKeysReady === true) &&
    isReady(right, switchKeysReady === true)

  const startTrade = async () => {
    if (!left || !right || !adapter || !ready) return
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setMessage('Starting trade…')
    setLastTrade(null)
    let usedPlaceholder = false
    try {
      const writes = await runTrade(left, right, controller.signal, {
        adapter,
        onEvent: (event) => {
          const status = statusForEvent(event)
          if (status) setMessage(status)
        },
        loadPlaceholder: async () => {
          usedPlaceholder = true
          const response = await fetch(ribbondolUrl)
          if (!response.ok) throw new Error('Could not load ribbondol.pk3.')
          return new Uint8Array(await response.arrayBuffer())
        },
      })
      setLastTrade(writes)
      setMessage(
        usedPlaceholder
          ? 'Trade complete. The GB-Link cannot return your new Pokémon, so the selected slot now holds the placeholder ribbondol.pk3. If the trade did not happen on the GBA, use Revert trade.'
          : 'Trade complete.'
      )
      // The selected slots changed; start over with fresh grids.
      setLeft(clearSelection)
      setRight(clearSelection)
      setReload((value) => value + 1)
    } catch (cause) {
      setMessage(describeError(cause))
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setBusy(false)
    }
  }

  const undoTrade = async () => {
    if (!lastTrade || !adapter) return
    setBusy(true)
    try {
      await revertTrade(lastTrade, { adapter })
      setLastTrade(null)
      setLeft(clearSelection)
      setRight(clearSelection)
      setReload((value) => value + 1)
      setMessage(
        'Trade reverted in PkCamp. Pokémon on a Game Boy Advance or Switch are not changed.'
      )
    } catch (cause) {
      setMessage(describeError(cause))
    } finally {
      setBusy(false)
    }
  }

  const cancelTrade = () => {
    abortRef.current?.abort()
    esp32TradeDevice.cancelTrade()
    gbLinkTradeDevice.cancelTrade()
    setMessage('Cancelling trade…')
  }

  const boxRef = useRef(initialBox)
  const handleBoxChange = useCallback((box: number) => {
    boxRef.current = box
  }, [])

  const handleBack = () => {
    if (busy && !window.confirm('Cancel the active trade and go back?')) return
    onBack(boxRef.current)
  }

  const panel = (
    name: SideName,
    label: string,
    value: TradeSide | null,
    other: TradeSide | null
  ) => (
    <SidePanel
      key={name}
      reload={reload}
      name={label}
      value={value}
      initialBox={
        value?.device === 'save-backup' && value.gameId === initialGameId
          ? initialBox
          : undefined
      }
      onBoxChange={
        value?.device === 'save-backup' && value.gameId === initialGameId
          ? handleBoxChange
          : undefined
      }
      other={other}
      disabled={busy}
      keysReady={switchKeysReady}
      onKeysReady={setSwitchKeysReady}
      onSource={(side) => setSide(name, () => side)}
      onSelection={(slot) => {
        if (!busy)
          setSide(name, (side) =>
            side?.device === 'save-backup' && 'box' in slot
              ? { ...side, slot }
              : side?.device === 'camp-site' && 'id' in slot
                ? { ...side, slot }
                : side
          )
      }}
      onDeviceChange={() => setDeviceRevision((value) => value + 1)}
      onMessage={setMessage}
    />
  )

  return (
    <div className="camp-root">
      <div className="camp-content camp-content--trade">
        <header className="camp-page-header">
          <button type="button" className="camp-back" onClick={handleBack}>
            {initialGameId ? '← Back to Cabin' : '← Back'}
          </button>
          <div className="camp-page-heading">
            <p className="camp-eyebrow">Trading Post</p>
            <h1 className="camp-title">Choose two trainers to trade</h1>
            <p className="camp-page-subtitle">Select trainers for each side.</p>
          </div>
          <span className="camp-page-header-spacer" aria-hidden="true" />
        </header>

        <div className="camp-trade-columns">
          {panel('left', 'Trainer Side A', left, right)}
          <div className="camp-trade-between" aria-hidden="true">
            ↔
          </div>
          {panel('right', 'Trainer Side B', right, left)}
        </div>

        <div className="camp-trade-actions">
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={!ready || busy}
            onClick={() => void startTrade()}
          >
            {busy ? 'Trading…' : 'Start trade'}
          </button>
          {busy && (
            <button
              type="button"
              className="camp-upload-btn"
              onClick={cancelTrade}
            >
              Cancel trade
            </button>
          )}
          {!busy && lastTrade && (
            <button
              type="button"
              className="camp-upload-btn"
              onClick={() => void undoTrade()}
            >
              Revert trade
            </button>
          )}
        </div>

        {message && (
          <p className="camp-status" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
