export const TRADE_DEVICE_IDS = [
  'esp32',
  'gb-link',
  'save-backup',
  'camp-site',
] as const

export type TradeDeviceId = (typeof TRADE_DEVICE_IDS)[number]

export type TradeDeviceState =
  'disconnected' | 'connecting' | 'connected' | 'trading' | 'disconnecting'

export type TradeParty = readonly (Uint8Array | null)[]

export type TradeDeviceEvent =
  | { type: 'status'; message: string; tone?: string }
  | { type: 'log'; message: string }
  | {
      type: 'device'
      model?: string
      firmware?: string
    }
  | {
      type: 'opponent-party'
      name: string
      party: (Uint8Array | null)[]
    }
  | { type: 'menu-open' }
  | { type: 'offer'; slot: number; accepted: boolean }
  | { type: 'trade-started' }
  | { type: 'declining'; value: boolean }
  | { type: 'room'; trades: number }
  | { type: 'trade-completed'; slot: number; received: Uint8Array }
  | { type: 'hardware-trade-finished'; receivedAvailable: boolean }

export interface TradeRequest {
  /** Exactly six positional PK3 slots. At least two must be occupied. */
  party: TradeParty
  selectedSlot: number
  /** Offer selectedSlot once when the first trade menu opens. Defaults to true. */
  autoOffer?: boolean
  signal?: AbortSignal
  onEvent?(event: TradeDeviceEvent): void
}

export interface CompletedTrade {
  slot: number
  sent: Uint8Array
  received: Uint8Array
}

export interface TradeResult {
  trades: CompletedTrade[]
  /** Party contents after all completed trades in this room. */
  party: (Uint8Array | null)[]
}

export interface TradeDevice {
  readonly id: TradeDeviceId
  readonly label: string
  readonly implemented: boolean
  readonly supported: boolean
  readonly state: TradeDeviceState

  connect(): Promise<void>
  disconnect(): Promise<void>
  trade(request: TradeRequest): Promise<TradeResult>
  offerSlot(slot: number): void
  declineTrade(): void
  cancelTrade(): void
}

export type TradeDeviceErrorCode =
  | 'unsupported'
  | 'not-implemented'
  | 'not-connected'
  | 'busy'
  | 'invalid-party'
  | 'invalid-keys'
  | 'missing-keys'

export class TradeDeviceError extends Error {
  readonly code: TradeDeviceErrorCode
  readonly deviceId: TradeDeviceId

  constructor(
    deviceId: TradeDeviceId,
    code: TradeDeviceErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'TradeDeviceError'
    this.deviceId = deviceId
    this.code = code
  }
}
