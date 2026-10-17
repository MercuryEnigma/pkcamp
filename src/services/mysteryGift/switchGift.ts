import { esp32TradeDevice } from '../tradeDevice'
import type {
  GiftDecision,
  GiftEvent,
  GiftLink,
  GiftLinkHandlers,
  GiftResult,
  GiftStatus,
} from './types'

/** Oldest ESP32 firmware that can host a Mystery Gift group, as upstream requires. */
export const MIN_SWITCH_GIFT_FIRMWARE = '2.1.0'

/**
 * Opens a Mystery Gift group for the Switch's FireRed and LeafGreen through the
 * ESP32 board, with the vendored GB-Link-Switch-LDN distribution. The Switch
 * joins from MYSTERY GIFT → WONDER CARDS → FRIEND → GBLINK.
 */
export async function openSwitchGift(
  giftId: string,
  handlers: GiftLinkHandlers,
  options?: { signal?: AbortSignal }
): Promise<GiftLink> {
  const [{ GiftDistribution }, { findEvent }] = await Promise.all([
    import('../tradeDevice/vendor/gb-link-switch-ldn/gift/distribution.js'),
    import('../tradeDevice/vendor/gb-link-switch-ldn/gift/events.js'),
  ])
  const find = (id: string): GiftEvent => {
    const event = findEvent(id)
    if (!event) throw new Error(`Unknown Mystery Gift: ${id}`)
    return event
  }
  const firstEvent = find(giftId)
  options?.signal?.throwIfAborted()
  await esp32TradeDevice.connect(options)
  options?.signal?.throwIfAborted()
  const claim = await esp32TradeDevice.claimForGift(
    MIN_SWITCH_GIFT_FIRMWARE,
    options?.signal
  )
  const signal = claim.signal
  const distribution = new GiftDistribution(claim.transport)
  let stopped = false
  let stopping: Promise<void> | null = null
  let starting: Promise<void> | null = null
  const detail = <T>(event: Event) => (event as CustomEvent<T>).detail
  distribution.addEventListener('status', (event) => {
    if (!stopped) handlers.onStatus(detail<GiftStatus>(event))
  })
  distribution.addEventListener('decision', (event) => {
    if (!stopped) handlers.onDecision(detail<GiftDecision | null>(event))
  })
  distribution.addEventListener('result', (event) => {
    if (!stopped) handlers.onResult(detail<GiftResult>(event))
  })

  const stop = (): Promise<void> => {
    if (stopping) return stopping
    stopped = true
    stopping = Promise.resolve().then(async () => {
      try {
        signal?.removeEventListener('abort', onAbort)
        // Upstream startup installs a ticker after awaiting its port claim.
        // Let that settle before stopping, so it cannot recreate the ticker.
        await starting?.catch(() => {})
        await distribution.stop()
      } finally {
        claim.release()
      }
    })
    return stopping
  }
  const onAbort = () => {
    if (stopped) return
    void stop()
      .catch(() => {})
      .then(() => {
        if (!options?.signal?.aborted)
          handlers.onFailed(new Error('The ESP32 disconnected.'))
      })
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  distribution.addEventListener('failed', (event) => {
    if (stopped) return
    const cause = detail<unknown>(event)
    void stop()
      .catch(() => {})
      .then(() =>
        handlers.onFailed(
          cause instanceof Error ? cause : new Error(String(cause))
        )
      )
  })

  try {
    signal?.throwIfAborted()
    starting = distribution.start(firstEvent)
    await starting
    signal?.throwIfAborted()
    if (stopped) throw new Error('The Mystery Gift group stopped.')
  } catch (error) {
    await stop()
    throw error
  }
  return {
    setGift: (id) => {
      if (!stopped) distribution.setEvent(find(id))
    },
    decide: (send) => {
      if (!stopped) distribution.decide(send)
    },
    stop,
  }
}
