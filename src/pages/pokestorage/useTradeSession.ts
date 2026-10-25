import { useTranslation } from 'react-i18next'
import { useNavigationGuard } from './navigationGuard'
import { useCallback, useEffect, useRef, useState } from 'react'
import ribbondolUrl from '../../assets/trade/ribbondol.pk3?url'
import type { Gen3GameId } from '../../services/saveLibrary'
import {
  esp32TradeDevice,
  gbLinkTradeDevice,
  revertTrade,
  runTrade,
  tradeAvailability,
  type TradeSide,
  type TradeWrite,
} from '../../services/tradeDevice'
import { usePkHex } from '../context/PkHexContext'
import {
  clearSelection,
  describeError,
  gbaSwitchPair,
  isReady,
  isStored,
  statusForEvent,
  type SideName,
} from './tradeRules'
import type { TradeSidePanelProps } from './TradeSidePanel'
import { useStorageOffline } from './useStorage'

/** Props shared by every two-sided trade page. */
export interface TradeViewProps {
  /** Receives the box open for `initialGameId`, to reopen in its Cabin. */
  onBack?: (box?: number) => void
  /** Called after a trade or revert changed what is stored. */
  onTraded?: () => void
  initialGameId?: Gen3GameId
  /** Box to open for `initialGameId`, e.g. the one open in its Cabin. */
  initialBox?: number
}

/**
 * State and actions of a two-sided trade: both sides, the running trade,
 * revert, and cancel. Pages only lay out the result and supply its text.
 */
export function useTradeSession({
  onBack,
  onTraded,
  initialGameId,
  initialBox,
}: TradeViewProps) {
  const { t } = useTranslation(['trade', 'common'] as const)

  const [left, setLeft] = useState<TradeSide | null>(
    initialGameId ? { device: 'save-backup', gameId: initialGameId } : null
  )
  const [right, setRight] = useState<TradeSide | null>(null)
  const [busy, setBusy] = useState(false)
  const confirmLeave = useNavigationGuard(
    busy,
    t('useTradeSession.cancelTheActiveTradeAndGoBack')
  )
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
      void esp32TradeDevice.disconnect().catch(() => {})
      void gbLinkTradeDevice.disconnect().catch(() => {})
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
    setMessage(
      relay
        ? t('useTradeSession.startingLink')
        : t('useTradeSession.startingTrade')
    )
    setLastTrade(null)
    let usedPlaceholder = false
    try {
      let placeholder: Uint8Array | null = null
      const loadPlaceholder = async (): Promise<Uint8Array> => {
        if (!placeholder) {
          const response = await fetch(ribbondolUrl)
          if (!response.ok)
            throw new Error(t('useTradeSession.couldNotLoadRibbondolPk3'))
          placeholder = new Uint8Array(await response.arrayBuffer())
        }
        return placeholder.slice()
      }
      if (!relay && (left.device === 'gb-link' || right.device === 'gb-link')) {
        setMessage(t('useTradeSession.preparingTrade'))
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
        setMessage(t('useTradeSession.linkStopped'))
        return
      }
      setLastTrade(writes)
      setMessage(
        usedPlaceholder
          ? t('useTradeSession.tradeCompleteTheGbLinkCannotReturnYourNewPoke')
          : t('useTradeSession.tradeComplete')
      )
      // The selected slots changed; start over with fresh grids.
      setLeft(clearSelection)
      setRight(clearSelection)
      setReload((value) => value + 1)
      onTraded?.()
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
      onTraded?.()
      setMessage(t('useTradeSession.tradeRevertedInPkcampPokeMonOnAGameBoy'))
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
    setMessage(
      viaSwitch
        ? t('useTradeSession.stoppingLink')
        : t('useTradeSession.cancellingTrade')
    )
  }

  const boxRef = useRef(initialBox)
  const handleBoxChange = useCallback((box: number) => {
    boxRef.current = box
  }, [])

  const handleBack = () => {
    if (!confirmLeave()) return
    onBack?.(boxRef.current)
  }

  /** Everything a side's panel needs except its visible name. */
  const sideProps = (name: SideName): Omit<TradeSidePanelProps, 'name'> => {
    const value = name === 'left' ? left : right
    const other = name === 'left' ? right : left
    const fromCabin =
      value?.device === 'save-backup' && value.gameId === initialGameId
    return {
      reload,
      value,
      initialBox: fromCabin ? initialBox : undefined,
      onBoxChange: fromCabin ? handleBoxChange : undefined,
      other,
      disabled: busy,
      keysReady: switchKeysReady,
      onKeysReady: setSwitchKeysReady,
      onSource: (side) => setSide(name, () => side),
      onGbaGame: (gbaGame) =>
        setSide(name, (side) =>
          side?.device === 'gb-link' ? { ...side, gbaGame } : side
        ),
      onSelection: (slot) => {
        if (!busy)
          setSide(name, (side) =>
            side?.device === 'save-backup' && 'box' in slot
              ? { ...side, slot }
              : side?.device === 'camp-site' && 'site' in slot
                ? { ...side, slot }
                : side
          )
      },
      onDeviceChange: () => setDeviceRevision((value) => value + 1),
      onMessage: setMessage,
    }
  }

  return {
    initialGameId,
    viaSwitch,
    gbaSide,
    writesStorage,
    ready,
    busy,
    message,
    lastTrade,
    offline,
    startTrade,
    undoTrade,
    cancelTrade,
    handleBack,
    sideProps,
  }
}
