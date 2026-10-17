import type { GiftEvent, GiftSessionCallbacks } from '../../../types'

export class WonderSession implements GiftSessionCallbacks {
  constructor(options: { send(frame: Uint8Array): void; log?(message: string): void })
  onStatus: GiftSessionCallbacks['onStatus']
  onDecision: GiftSessionCallbacks['onDecision']
  onResult: GiftSessionCallbacks['onResult']
  setEvent(event: GiftEvent): void
  decide(send: boolean): void
  start(): void
  stop(): void
  tick(): void
  receive(frame: Uint8Array): void
}
