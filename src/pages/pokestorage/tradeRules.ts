import { i18n } from '../../services/i18n'
import {
  compareFirmwareVersions,
  esp32TradeDevice,
  gbLinkTradeDevice,
  MIN_GBA_SWITCH_FIRMWARE,
  type TradeDeviceEvent,
  type TradeSide,
} from '../../services/tradeDevice'

/*
 * Pure rules shared by every trade page: which sides pair, when a side is
 * ready, and how device events read as status text. No React here.
 */

export type LocalSlot = NonNullable<
  Extract<TradeSide, { device: 'save-backup' | 'camp-site' }>['slot']
>

export type SideName = 'left' | 'right'

export type GbaGame = 'wireless' | 'cable'

export function gbaSwitchPair(
  left: TradeSide | null,
  right: TradeSide | null
): boolean {
  return (
    (left?.device === 'gb-link' && right?.device === 'esp32') ||
    (left?.device === 'esp32' && right?.device === 'gb-link')
  )
}

export function firmwareTooOld(version: string | null): boolean {
  return (
    !version || compareFirmwareVersions(version, MIN_GBA_SWITCH_FIRMWARE) < 0
  )
}

export function describeError(cause: unknown): string {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return i18n.t('trade:tradeRules.tradeCancelled')
  }
  return cause instanceof Error ? cause.message : String(cause)
}

export function statusForEvent(event: TradeDeviceEvent): string | null {
  switch (event.type) {
    case 'status':
      return event.message
    case 'device':
      return event.firmware
        ? i18n.t('trade:tradeRules.esp32ConnectedFirmware', {
            firmware: event.firmware,
          })
        : i18n.t('trade:tradeRules.esp32Connected')
    case 'opponent-party':
      return i18n.t('trade:tradeRules.connectedTo', { name: event.name })
    case 'menu-open':
      return i18n.t('trade:tradeRules.tradeMenuOpenOfferingYourSelectedPokeMon')
    case 'offer':
      return event.accepted
        ? i18n.t('trade:tradeRules.offerSentChooseAPokeMonOnTheSwitch')
        : i18n.t('trade:tradeRules.theSelectedPokeMonCouldNotBeOffered')
    case 'trade-started':
      return i18n.t('trade:tradeRules.tradeInProgress')
    case 'trade-completed':
      return i18n.t(
        'trade:tradeRules.tradeCompleteLeaveTheRoomOnTheSwitchToFinish'
      )
    case 'room':
      return event.trades > 0
        ? i18n.t('trade:tradeRules.backInTheTradeRoomLeaveTheRoomOnThe')
        : null
    case 'hardware-trade-finished':
      return i18n.t('trade:tradeRules.theGameBoyAdvanceFinishedTheTradeSaving')
    default:
      return null
  }
}

export function clearSelection(side: TradeSide | null): TradeSide | null {
  if (side?.device === 'save-backup') {
    return { device: 'save-backup', gameId: side.gameId }
  }
  if (side?.device === 'camp-site') return { device: 'camp-site' }
  return side
}

export function isStored(side: TradeSide | null): boolean {
  return side?.device === 'save-backup' || side?.device === 'camp-site'
}

export function isReady(
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
