import { useTranslation, Trans } from 'react-i18next'
import { i18n } from '../../services/i18n'
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
import { getGameLabel } from './gameDisplay'
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
const getSourceOptions = (): readonly { label: string; side: TradeSide }[] => [
  ...SAVE_IDS.map((gameId) => ({
    label: i18n.t('trade:TradeSidePanel.backup', {
      value1: getGameLabel(gameId),
    }),
    side: { device: 'save-backup', gameId } as TradeSide,
  })),
  {
    label: i18n.t('trade:TradeSidePanel.campSites'),
    side: { device: 'camp-site' },
  },
  {
    label: i18n.t('trade:TradeSidePanel.gameBoyAdvanceViaGbLink'),
    side: { device: 'gb-link' },
  },
  {
    label: i18n.t('trade:TradeSidePanel.switchViaEsp32'),
    side: { device: 'esp32' },
  },
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
  const { t } = useTranslation(['trade', 'common'] as const)

  const isGba = kind === 'gb-link'
  const device = isGba ? gbLinkTradeDevice : esp32TradeDevice
  const setKeysReady = onKeysReady
  const [working, setWorking] = useState(false)
  const lifetime = useRef<AbortController | null>(null)
  useNavigationGuard(
    working,
    t('TradeSidePanel.hardwareSetupIsActiveCancelItAndLeave')
  )
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
        throw new Error(t('TradeSidePanel.thatFileIsTooLargeToBeProdKeys'))
      }
      onMessage(t('TradeSidePanel.storingTheRequiredKeysOnTheEsp32'))
      await esp32TradeDevice.storeProdKeys(await file.text())
      setKeysReady(true)
      onMessage(t('TradeSidePanel.keysStored'))
    })
  }

  const stateLabel = !device.supported
    ? t('TradeSidePanel.notSupportedInThisBrowser')
    : device.state === 'disconnected'
      ? t('TradeSidePanel.notConnected')
      : device.state === 'trading'
        ? t('TradeSidePanel.trading')
        : t('TradeSidePanel.connected')

  // Firmware and key setup steps, shown below either layout.
  const setup = (
    <>
      {outdated && (
        <div className="camp-trade-setup">
          <strong>
            {t('TradeSidePanel.gbLinkFirmwareGbaSwitchNeedsOrNewer', {
              value1: gbLinkTradeDevice.knownFirmwareVersion ?? 'unknown',
              value2: release?.version ?? MIN_GBA_SWITCH_FIRMWARE,
            })}
          </strong>
          <p>
            {release && (
              <Trans
                ns="trade"
                i18nKey="TradeSidePanel.downloadFirmwareLink"
                components={{
                  firmwareLink: (
                    <a href={release.url} target="_blank" rel="noreferrer" />
                  ),
                }}
              />
            )}
            {t('TradeSidePanel.manualFirmwareSteps')}
          </p>
          <button
            type="button"
            className="camp-upload-btn"
            disabled={disabled || working}
            onClick={() => void enterUpdateMode()}
          >
            {t('TradeSidePanel.enterUpdateMode')}
          </button>
        </div>
      )}
      {!isGba && connected && keysReady === false && (
        <div className="camp-trade-setup">
          <strong>{t('TradeSidePanel.switchKeysRequired')}</strong>
          <p>
            <Trans
              ns="trade"
              i18nKey="TradeSidePanel.choosePart1ProdKeysPart1FromYourOwnSwitchThe"
              components={{ part1: <code /> }}
            />
          </p>
          <label className="camp-upload-btn camp-upload-btn--primary">
            {t('TradeSidePanel.chooseProdKeys')}
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
          {isGba ? 'GB-Link' : t('TradeSidePanel.switchViaEsp32')}
        </span>
        <strong className="camp-trade-device-state">{stateLabel}</strong>
        <p>
          {!device.supported
            ? t('TradeSidePanel.useAChromiumBasedBrowserSuchAsChromeOrEdge')
            : connected
              ? t('TradeSidePanel.chooseAPokeMonOnYourDuringTheTrade', {
                  value1: isGba ? 'Game Boy Advance' : 'Switch',
                })
              : t('TradeSidePanel.connectYourToChooseAPokeMonDuringTheTrade', {
                  value1: isGba ? 'Game Boy Advance' : 'ESP32',
                })}
        </p>
        {device.supported && (
          <button
            type="button"
            className="camp-upload-btn"
            disabled={disabled || working || device.state === 'trading'}
            onClick={() => void (connected ? disconnect() : connect())}
          >
            {connected
              ? t('common:actions.disconnect')
              : t('common:actions.connect')}
          </button>
        )}
        {setup}
      </div>
    )
  }

  return (
    <div className="camp-trade-hardware">
      <strong>
        {t('TradeSidePanel.connection', {
          value1: isGba ? 'GB-Link' : 'ESP32',
        })}
      </strong>
      <p>
        {t('TradeSidePanel.chooseThePokeMonOnYourDuringTheTrade', {
          value1: isGba ? 'Game Boy Advance' : 'Switch',
        })}
      </p>
      {device.supported ? (
        <>
          <span className="camp-trade-device-status">
            {device.state === 'disconnected'
              ? t('TradeSidePanel.notConnected')
              : device.state === 'trading'
                ? t('TradeSidePanel.trading')
                : t('TradeSidePanel.connected')}
          </span>
          <div className="camp-local-actions">
            <button
              type="button"
              className="camp-upload-btn"
              disabled={disabled || working || device.state === 'trading'}
              onClick={() => void (connected ? disconnect() : connect())}
            >
              {connected
                ? t('common:actions.disconnect')
                : t('common:actions.connect')}
            </button>
          </div>
        </>
      ) : (
        <span className="camp-trade-device-status camp-trade-device-status--warning">
          {t(
            'TradeSidePanel.thisBrowserDoesNotSupportTheRequiredDeviceConnection'
          )}
        </span>
      )}
      <p className="camp-trade-note">
        {isGba
          ? t('TradeSidePanel.connectTheGbLinkToThisComputerAndTheLink')
          : t('TradeSidePanel.connectTheEsp32ByUsb')}
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
  const { t } = useTranslation(['trade', 'common'] as const)

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
              getSourceOptions().find(
                (option) => tradeSideKey(option.side) === event.target.value
              )?.side ?? null
            )
          }
        >
          <option value="">{t('TradeSidePanel.chooseASource')}</option>
          {getSourceOptions().map(({ label, side }) => {
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
          {t('TradeSidePanel.chooseTheGameOrStorageSourceForThisSide')}
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
          <span>{t('TradeSidePanel.gameOnTheGba')}</span>
          <select
            className="camp-select"
            value={value.gbaGame ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onGbaGame((event.target.value as GbaGame) || undefined)
            }
          >
            <option value="">{t('TradeSidePanel.chooseTheGame')}</option>
            <option value="wireless">
              {t('TradeSidePanel.fireredLeafgreenOrEmerald')}
            </option>
            <option value="cable">{t('TradeSidePanel.rubyOrSapphire')}</option>
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
