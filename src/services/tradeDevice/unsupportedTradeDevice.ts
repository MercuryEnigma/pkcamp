import {
  TradeDeviceError,
  type TradeDevice,
  type TradeDeviceId,
  type TradeDeviceState,
  type TradeRequest,
  type TradeResult,
} from './types.ts'

abstract class UnsupportedTradeDevice implements TradeDevice {
  abstract readonly id: TradeDeviceId
  abstract readonly label: string
  readonly implemented = false
  readonly supported = false
  readonly state: TradeDeviceState = 'disconnected'

  private unavailable(): never {
    throw new TradeDeviceError(
      this.id,
      'not-implemented',
      `${this.label} trading is not implemented yet.`
    )
  }

  connect(): Promise<void> {
    return Promise.reject(this.unavailable())
  }

  disconnect(): Promise<void> {
    return Promise.resolve()
  }

  trade(_request: TradeRequest): Promise<TradeResult> {
    return Promise.reject(this.unavailable())
  }

  offerSlot(_slot: number): void {
    this.unavailable()
  }

  declineTrade(): void {
    this.unavailable()
  }

  cancelTrade(): void {}
}

export class GbLinkTradeDevice extends UnsupportedTradeDevice {
  readonly id = 'gb-link'
  readonly label = 'GB-Link'
}

export class SaveBackupTradeDevice extends UnsupportedTradeDevice {
  readonly id = 'save-backup'
  readonly label = 'Save backup'
}
