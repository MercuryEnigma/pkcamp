/** A Wonder Card event as the vendored gift senders describe it. */
export interface GiftEvent {
  id: string
  label: string
  description: string
  kind?: string | null
}

/** Where a gift is sent: a GBA over GB-Link, or the Switch's GBA games over ESP32. */
export type GiftTarget = 'gba' | 'switch'

export interface GiftPlayer {
  name?: string
}

/** A step of the exchange with the console that joined, as the senders report it. */
export interface GiftStatus {
  stage: string
  event?: GiftEvent | null
  player?: GiftPlayer | null
  detail?: unknown
}

/** The console already holds this card, or another one; `decide` answers it. */
export interface GiftDecision {
  reasons: string[]
  event?: GiftEvent | null
}

export interface GiftResult {
  outcome: string
  event?: GiftEvent | null
  player?: GiftPlayer | null
  message?: string
}

export interface GiftSessionCallbacks {
  onStatus: ((status: GiftStatus) => void) | null
  onDecision: ((decision: GiftDecision | null) => void) | null
  onResult: ((result: GiftResult) => void) | null
}

export interface GiftLinkHandlers {
  onStatus(status: GiftStatus): void
  onDecision(decision: GiftDecision | null): void
  onResult(result: GiftResult): void
  /** The link ended on its own, e.g. the device was unplugged. */
  onFailed(error: Error): void
}

/** An open Mystery Gift group: it sends the chosen card to each console that joins. */
export interface GiftLink {
  /** The card for the next console; a link in progress keeps its own. */
  setGift(giftId: string): void
  /** Answers a pending decision: true sends the card anyway. */
  decide(send: boolean): void
  stop(): Promise<void>
}
