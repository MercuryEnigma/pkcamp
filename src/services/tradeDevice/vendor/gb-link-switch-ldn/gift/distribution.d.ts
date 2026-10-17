import type { GiftEvent } from '../../../../mysteryGift/types'

// Events: 'status', 'decision', 'result' (CustomEvent with the session's
// detail), 'log' (CustomEvent<string>), 'failed' (CustomEvent<unknown>).
export class GiftDistribution extends EventTarget {
  constructor(esp: unknown)
  running: boolean
  start(event: GiftEvent): Promise<void>
  setEvent(event: GiftEvent): void
  decide(send: boolean): void
  stop(): Promise<void>
}
