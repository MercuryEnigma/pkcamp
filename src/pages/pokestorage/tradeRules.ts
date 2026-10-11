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
    return 'Trade cancelled.'
  }
  return cause instanceof Error ? cause.message : String(cause)
}

export function statusForEvent(event: TradeDeviceEvent): string | null {
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
