import { useEffect, useRef, useState } from 'react'
import { useNavigationGuard } from './navigationGuard'
import type { Gen3GameId } from '../../services/saveLibrary'
import {
  esp32TradeDevice,
  gbLinkFirmwareRelease,
  gbLinkTradeDevice,
  MIN_GBA_SWITCH_FIRMWARE,
  tradeAvailability,
  tradeSideKey,
  type TradeSide,
} from '../../services/tradeDevice'
import { GAME_LABEL } from './gameDisplay'
import {
  describeError,
  firmwareTooOld,
  gbaSwitchPair,
  type GbaGame,
  type LocalSlot,
} from './tradeRules'
import { CampSelectionPanel, SaveSelectionPanel } from './TradeSelectionPanels'

/*
 * One side of a two-sided trade page: its source picker and either a Pokémon
 * grid (stored sources) or a device connection panel (hardware). Shared by
 * the Camp Zone Trading Post and the Lab Zone Trade Table.
 */

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

/** Connection and setup status for a hardware side. No Pokémon is chosen here. */
function DevicePanel({
  kind,
  disabled,
  keysReady,
  onKeysReady,
  onChange,
  onMessage,
  viaSwitch,
  compact = false,
}: {
  kind: 'gb-link' | 'esp32'
  /** One status line, one sentence, one button: the Lab's simpler layout. */
  compact?: boolean
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
  const lifetime = useRef<AbortController | null>(null)
  useNavigationGuard(working, 'Hardware setup is active. Cancel it and leave?')
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    return () => controller.abort()
  }, [device])
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
    const signal = lifetime.current!.signal
    setWorking(true)
    try {
      await action()
    } catch (cause) {
      if (!signal.aborted) onMessage(describeError(cause))
    } finally {
      if (!signal.aborted) {
        setWorking(false)
        onChange()
      }
    }
  }

  const connect = () =>
    run(async () => {
      const signal = lifetime.current!.signal
      await device.connect({ signal })
      signal.throwIfAborted()
      if (isGba) {
        await gbLinkTradeDevice.firmwareVersion().catch(() => null)
        signal.throwIfAborted()
        setFirmwareChecked(true)
      } else {
        const keys = await esp32TradeDevice.keyStatus()
        signal.throwIfAborted()
        setKeysReady(Boolean(keys?.complete))
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

  const stateLabel = !device.supported
    ? 'Not supported in this browser'
    : device.state === 'disconnected'
      ? 'Not connected'
      : device.state === 'trading'
        ? 'Trading'
        : 'Connected'

  // Firmware and key setup steps, shown below either layout.
  const setup = (
    <>
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
    </>
  )

  if (compact) {
    return (
      <div className="camp-trade-hardware camp-trade-hardware--compact">
        <span className="camp-trade-device-name">
          {isGba ? 'GB-Link' : 'Switch via ESP32'}
        </span>
        <strong className="camp-trade-device-state">{stateLabel}</strong>
        <p>
          {!device.supported
            ? 'Use a Chromium-based browser such as Chrome or Edge to connect.'
            : connected
              ? `Choose a Pokémon on your ${isGba ? 'Game Boy Advance' : 'Switch'} during the trade.`
              : `Connect your ${isGba ? 'Game Boy Advance' : 'ESP32'} to choose a Pokémon during the trade.`}
        </p>
        {device.supported && (
          <button
            type="button"
            className="camp-upload-btn"
            disabled={disabled || working || device.state === 'trading'}
            onClick={() => void (connected ? disconnect() : connect())}
          >
            {connected ? 'Disconnect' : 'Connect'}
          </button>
        )}
        {setup}
      </div>
    )
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
      {setup}
    </div>
  )
}

export interface TradeSidePanelProps {
  name: string
  /** Use the compact device panel (the Lab's layout). */
  compactDevice?: boolean
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
}

export function TradeSidePanel({
  name,
  compactDevice = false,
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
}: TradeSidePanelProps) {
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
          compact={compactDevice}
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
