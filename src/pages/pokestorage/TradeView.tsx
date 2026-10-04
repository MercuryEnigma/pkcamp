import { useCallback, useEffect, useRef, useState } from 'react'
import ribbondolUrl from '../../assets/saves/ribbondol.pk3?url'
import type { Gen3GameId } from '../../services/saveLibrary'
import {
  compareFirmwareVersions,
  esp32TradeDevice,
  gbLinkFirmwareRelease,
  gbLinkTradeDevice,
  MIN_GBA_SWITCH_FIRMWARE,
  revertTrade,
  runTrade,
  tradeAvailability,
  tradeSideKey,
  type TradeDeviceEvent,
  type TradeSide,
  type TradeWrite,
} from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexContext'
import { GAME_LABEL } from './gameDisplay'
import { useStorageOffline } from './useStorage'
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

type GbaGame = 'wireless' | 'cable'

function gbaSwitchPair(
  left: TradeSide | null,
  right: TradeSide | null
): boolean {
  return (
    (left?.device === 'gb-link' && right?.device === 'esp32') ||
    (left?.device === 'esp32' && right?.device === 'gb-link')
  )
}

function firmwareTooOld(version: string | null): boolean {
  return (
    !version || compareFirmwareVersions(version, MIN_GBA_SWITCH_FIRMWARE) < 0
  )
}

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

function isStored(side: TradeSide | null): boolean {
  return side?.device === 'save-backup' || side?.device === 'camp-site'
}

function isReady(
  side: TradeSide | null,
  switchKeysReady: boolean,
  viaSwitch: boolean
): boolean {
  if (!side) return false
  if (side.device === 'save-backup' || side.device === 'camp-site') {
    return !!side.slot
  }
  if (side.device === 'esp32') {
    return esp32TradeDevice.state === 'connected' && switchKeysReady
  }
  if (viaSwitch) {
    return (
      !!side.gbaGame &&
      gbLinkTradeDevice.state === 'connected' &&
      !firmwareTooOld(gbLinkTradeDevice.knownFirmwareVersion)
    )
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
  viaSwitch,
}: {
  kind: 'gb-link' | 'esp32'
  /** The GBA is paired with the Switch, which needs newer GB-Link firmware. */
  viaSwitch: boolean
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
  // Whether the GB-Link firmware version has been read since connecting.
  const [firmwareChecked, setFirmwareChecked] = useState(false)
  const [release, setRelease] = useState<{
    version: string
    url: string
  } | null>(null)
  const outdated =
    isGba &&
    viaSwitch &&
    connected &&
    firmwareChecked &&
    firmwareTooOld(gbLinkTradeDevice.knownFirmwareVersion)

  useEffect(() => {
    if (outdated && !release) {
      void gbLinkFirmwareRelease().then(setRelease)
    }
  }, [outdated, release])

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
      if (isGba) {
        await gbLinkTradeDevice.firmwareVersion().catch(() => null)
        setFirmwareChecked(true)
      } else {
        setKeysReady(Boolean((await esp32TradeDevice.keyStatus())?.complete))
      }
    })

  const disconnect = () =>
    run(async () => {
      await device.disconnect()
      setKeysReady(null)
      setFirmwareChecked(false)
    })

  const enterUpdateMode = () =>
    run(async () => {
      await gbLinkTradeDevice.rebootToBootloader()
      setFirmwareChecked(false)
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
      {outdated && (
        <div className="camp-trade-setup">
          <strong>
            GB-Link firmware{' '}
            {gbLinkTradeDevice.knownFirmwareVersion ?? 'unknown'} — GBA ↔ Switch
            needs {release?.version ?? MIN_GBA_SWITCH_FIRMWARE} or newer.
          </strong>
          <p>
            {release && (
              <>
                <a href={release.url} target="_blank" rel="noreferrer">
                  Download the firmware
                </a>
                .{' '}
              </>
            )}
            Download the .uf2 file, press Enter update mode, then copy the file
            to the RPI-RP2 drive that appears. Reconnect afterwards.
          </p>
          <button
            type="button"
            className="camp-upload-btn"
            disabled={disabled || working}
            onClick={() => void enterUpdateMode()}
          >
            Enter update mode
          </button>
        </div>
      )}
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
  onGbaGame,
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
  onGbaGame: (game: GbaGame | undefined) => void
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
                {label}
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
      {value?.device === 'gb-link' && gbaSwitchPair(value, other) && (
        <label className="camp-trade-source-label">
          <span>Game on the GBA</span>
          <select
            className="camp-select"
            value={value.gbaGame ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onGbaGame((event.target.value as GbaGame) || undefined)
            }
          >
            <option value="">Choose the game…</option>
            <option value="wireless">FireRed, LeafGreen or Emerald</option>
            <option value="cable">Ruby or Sapphire</option>
          </select>
        </label>
      )}
      {(value?.device === 'gb-link' || value?.device === 'esp32') && (
        <DevicePanel
          viaSwitch={gbaSwitchPair(value, other)}
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
  const offline = useStorageOffline()

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

  const viaSwitch = gbaSwitchPair(left, right)
  const gbaSide = left?.device === 'gb-link' ? left : right
  // A trade writes PkCamp storage, so it waits while Dropbox is unreachable.
  const writesStorage = !viaSwitch && (isStored(left) || isStored(right))
  const ready =
    !(offline && writesStorage) &&
    left !== null &&
    right !== null &&
    (adapter !== null || viaSwitch) &&
    tradeAvailability(left, right) === 'ok' &&
    isReady(left, switchKeysReady === true, viaSwitch) &&
    isReady(right, switchKeysReady === true, viaSwitch)

  const startTrade = async () => {
    if (!left || !right || !ready) return
    // GBA ↔ Switch is a live relay and writes nothing, so it needs no save adapter.
    const relay = viaSwitch
    const pkAdapter = adapter ?? ({} as NonNullable<typeof adapter>)
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setMessage(relay ? 'Starting link…' : 'Starting trade…')
    setLastTrade(null)
    let usedPlaceholder = false
    try {
      let placeholder: Uint8Array | null = null
      const loadPlaceholder = async (): Promise<Uint8Array> => {
        if (!placeholder) {
          const response = await fetch(ribbondolUrl)
          if (!response.ok) throw new Error('Could not load ribbondol.pk3.')
          placeholder = new Uint8Array(await response.arrayBuffer())
        }
        return placeholder.slice()
      }
      if (!relay && (left.device === 'gb-link' || right.device === 'gb-link')) {
        setMessage('Preparing trade…')
        await loadPlaceholder()
      }
      const writes = await runTrade(left, right, controller.signal, {
        adapter: pkAdapter,
        onEvent: (event) => {
          const status = statusForEvent(event)
          if (status) setMessage(status)
        },
        loadPlaceholder: async () => {
          usedPlaceholder = true
          return loadPlaceholder()
        },
      })
      if (relay) {
        setMessage('Link stopped.')
        return
      }
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
    setMessage(viaSwitch ? 'Stopping link…' : 'Cancelling trade…')
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
      onGbaGame={(gbaGame) =>
        setSide(name, (side) =>
          side?.device === 'gb-link' ? { ...side, gbaGame } : side
        )
      }
      onSelection={(slot) => {
        if (!busy)
          setSide(name, (side) =>
            side?.device === 'save-backup' && 'box' in slot
              ? { ...side, slot }
              : side?.device === 'camp-site' && 'site' in slot
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

        {viaSwitch && (
          <div className="camp-trade-note">
            <p>
              On the Switch, lead a Trade Center group upstairs in a Pokémon
              Center.
            </p>
            <p>
              {gbaSide?.device === 'gb-link' && gbaSide.gbaGame === 'wireless'
                ? 'On the GBA, join the group.'
                : gbaSide?.device === 'gb-link' && gbaSide.gbaGame === 'cable'
                  ? 'On the GBA, talk to the middle counter upstairs in a Pokémon Center.'
                  : 'Choose the game on the GBA.'}
            </p>
            <p>
              Both players choose their Pokémon on their own console. PkCamp
              doesn't store anything from this trade.
            </p>
          </div>
        )}

        <div className="camp-trade-actions">
          <button
            type="button"
            className="camp-confirm-btn"
            disabled={viaSwitch && busy ? false : !ready || busy}
            onClick={() =>
              viaSwitch && busy ? cancelTrade() : void startTrade()
            }
          >
            {viaSwitch
              ? busy
                ? 'Stop link'
                : 'Start link'
              : busy
                ? 'Trading…'
                : 'Start trade'}
          </button>
          {busy && !viaSwitch && (
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
              disabled={offline}
              onClick={() => void undoTrade()}
            >
              Revert trade
            </button>
          )}
        </div>

        {offline && writesStorage && (
          <p className="camp-status">
            Dropbox is unreachable. Trades that change PkCamp storage are paused
            until it reconnects.
          </p>
        )}

        {message && (
          <p className="camp-status" aria-live="polite">
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
