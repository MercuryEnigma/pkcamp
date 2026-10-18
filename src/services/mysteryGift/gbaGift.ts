import {
  compareFirmwareVersions,
  GB_LINK_COMMAND,
  GB_LINK_MODE,
  GB_LINK_STATUS,
  MIN_GBA_SWITCH_FIRMWARE,
} from '../tradeDevice/gbLinkProtocol'
import { gbLinkTradeDevice } from '../tradeDevice'
import type { GiftEvent, GiftLink, GiftLinkHandlers } from './types'

/** The adapter's RFU frames arrive in packets of this size. */
const PACKET_BYTES = 64

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function loadSender() {
  const [wonder, rfu1, ticker, custom, goppier] = await Promise.all([
    import('./vendor/gblink-wondercards/link/wonder.js'),
    import('./vendor/gblink-wondercards/link/rfu1.js'),
    import('./vendor/gblink-wondercards/link/ticker.js'),
    import('./vendor/gblink-wondercards/events/custom-events.js'),
    import('./vendor/gblink-wondercards/events/goppier-events.js'),
  ])
  const events = [
    ...custom.customWondercardEvents,
    ...goppier.goppierWondercardEvents,
  ]
  const find = (id: string): GiftEvent => {
    const event = events.find((candidate) => candidate.id === id)
    if (!event) throw new Error(`Unknown Mystery Gift: ${id}`)
    return event
  }
  return { ...wonder, ...rfu1, ...ticker, find }
}

/**
 * Opens a Mystery Gift group on a GBA through the GB-Link in Wireless Adapter
 * mode, with the vendored gblink-wondercards distributor. The GBA joins from
 * MYSTERY GIFT → WIRELESS COMMUNICATION and receives the chosen card.
 */
export async function openGbaGift(
  giftId: string,
  handlers: GiftLinkHandlers,
  options?: { signal?: AbortSignal }
): Promise<GiftLink> {
  const sender = await loadSender()
  const firstEvent = sender.find(giftId)
  options?.signal?.throwIfAborted()
  await gbLinkTradeDevice.connect(options)
  options?.signal?.throwIfAborted()
  const firmware = await gbLinkTradeDevice.firmwareVersion()
  options?.signal?.throwIfAborted()
  if (
    !firmware ||
    compareFirmwareVersions(firmware, MIN_GBA_SWITCH_FIRMWARE) < 0
  ) {
    throw new Error(
      `Mystery Gift needs GB-Link firmware ${MIN_GBA_SWITCH_FIRMWARE} or newer${firmware ? `; this GB-Link has ${firmware}` : ''}. Open Settings → Hardware to update it.`
    )
  }

  const controller = new AbortController()
  const lease = gbLinkTradeDevice.claim(controller.signal)
  const { transport } = lease
  const signal = options?.signal
    ? AbortSignal.any([options.signal, lease.signal])
    : lease.signal
  const reader = new sender.Rfu1Reader()
  let writes: Promise<void> = Promise.resolve()
  const send = (frame: Uint8Array) => {
    for (let at = 0; at < frame.length; at += PACKET_BYTES) {
      const packet = frame.slice(at, at + PACKET_BYTES)
      writes = writes.then(() => transport.sendData(packet)).catch(() => {})
    }
  }
  const session = new sender.WonderSession({ send })
  let stopped = false
  session.onStatus = (value) => {
    if (!stopped) handlers.onStatus(value)
  }
  session.onDecision = (value) => {
    if (!stopped) handlers.onDecision(value)
  }
  session.onResult = (value) => {
    if (!stopped) handlers.onResult(value)
  }
  session.setEvent(firstEvent)

  let stopTicker: (() => void) | null = null
  let stopping: Promise<void> | null = null
  let cancelReady: (() => void) | undefined
  const removeData = transport.onData((payload) => {
    if (stopped || payload.length !== PACKET_BYTES) return
    for (const frame of reader.push(payload)) session.receive(frame)
  })
  const removeStatus = transport.onStatus((status) => {
    if (status === GB_LINK_STATUS.linkClosed && !stopped) {
      void stop()
        .catch(() => {})
        .then(() =>
          handlers.onFailed(
            new Error('The GB-Link left Wireless Adapter mode.')
          )
        )
    }
  })

  const stop = (): Promise<void> => {
    if (stopping) return stopping
    stopped = true
    stopping = Promise.resolve().then(async () => {
      try {
        signal.removeEventListener('abort', onAbort)
        cancelReady?.()
        removeData()
        removeStatus()
        stopTicker?.()
        session.stop()
        await writes
        await delay(50)
        await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
      } finally {
        lease.free()
        // Closing the group hands the GB-Link back for the next tool.
        await gbLinkTradeDevice.disconnect().catch(() => {})
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
          handlers.onFailed(new Error('The GB-Link disconnected.'))
      })
  }
  signal.addEventListener('abort', onAbort, { once: true })

  try {
    signal.throwIfAborted()
    await transport.sendCommand(GB_LINK_COMMAND.cancel)
    await delay(300)
    signal.throwIfAborted()
    if (stopped) throw new Error('The Mystery Gift group stopped.')
    await transport.sendCommand(GB_LINK_COMMAND.setVoltage3V3)
    signal.throwIfAborted()
    if (stopped) throw new Error('The Mystery Gift group stopped.')
    const ready = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => done(false), 3000)
      const remove = transport.onStatus((status) => {
        if (status === GB_LINK_STATUS.awaitMode) done(true)
      })
      function done(value: boolean) {
        clearTimeout(timer)
        remove()
        cancelReady = undefined
        resolve(value)
      }
      cancelReady = () => done(false)
    })
    await transport.sendCommand(
      GB_LINK_COMMAND.setMode,
      new Uint8Array([GB_LINK_MODE.rfuWireless, 0])
    )
    if (!(await ready)) {
      throw new Error(
        "The GB-Link didn't start Wireless Adapter mode. Unplug it, plug it back in, and try again."
      )
    }
    signal.throwIfAborted()
    if (stopped) throw new Error('The Mystery Gift group stopped.')
    session.start()
    stopTicker = sender.startTicker(() => session.tick())
  } catch (error) {
    await stop()
    throw error
  }

  return {
    setGift: (id) => {
      if (!stopped) session.setEvent(sender.find(id))
    },
    decide: (sendAnyway) => {
      if (!stopped) session.decide(sendAnyway)
    },
    stop,
  }
}
