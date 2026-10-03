import type { GbLinkTransport } from '../tradeDevice/gbLinkTransport.ts'

/**
 * Words per USB write: 14 × 4 = 56 bytes, below the 64-byte endpoint and
 * Web Serial frame cap.
 */
export const BATCH_WORDS = 14

const READ_TIMEOUT_MS = 3000

export class LinkTimeoutError extends Error {
  constructor() {
    super('The GB-Link stopped answering. Is the link cable connected?')
    this.name = 'LinkTimeoutError'
  }
}

/**
 * Lockstep 32-bit exchanges in GB-Link "GB link" mode: the adapter clocks each
 * big-endian word we write out over SPI and answers with the word it received.
 */
export class GbLinkWords {
  private readonly transport: GbLinkTransport
  private readonly signal: AbortSignal
  private buffer = new Uint8Array(0)
  private wake: (() => void) | null = null
  private readonly removeListener: () => void

  constructor(transport: GbLinkTransport, signal: AbortSignal) {
    this.transport = transport
    this.signal = signal
    this.removeListener = transport.onData((payload) => {
      const next = new Uint8Array(this.buffer.length + payload.length)
      next.set(this.buffer)
      next.set(payload, this.buffer.length)
      this.buffer = next
      this.wake?.()
    })
  }

  dispose(): void {
    this.removeListener()
    this.wake?.()
  }

  /** Drops replies left over from earlier exchanges or another mode. */
  drain(): void {
    this.buffer = new Uint8Array(0)
  }

  /**
   * Exchanges `words` in order. Pass `ignoreAbort` to send a final word (such
   * as an abort request) after the session's signal has fired.
   */
  async exchange(
    words: readonly number[],
    { ignoreAbort = false } = {}
  ): Promise<number[]> {
    const signal = ignoreAbort ? new AbortController().signal : this.signal
    const results: number[] = []
    for (let start = 0; start < words.length; start += BATCH_WORDS) {
      const chunk = words.slice(start, start + BATCH_WORDS)
      const tx = new Uint8Array(chunk.length * 4)
      const view = new DataView(tx.buffer)
      chunk.forEach((word, index) => view.setUint32(index * 4, word >>> 0))
      signal.throwIfAborted()
      await this.transport.sendData(tx)
      const rx = await this.read(tx.length, signal)
      const rxView = new DataView(rx.buffer, rx.byteOffset, rx.byteLength)
      for (let index = 0; index < chunk.length; index++) {
        results.push(rxView.getUint32(index * 4))
      }
    }
    return results
  }

  async exchangeOne(
    word: number,
    options?: { ignoreAbort?: boolean }
  ): Promise<number> {
    return (await this.exchange([word], options))[0]
  }

  private async read(length: number, signal: AbortSignal): Promise<Uint8Array> {
    const deadline = Date.now() + READ_TIMEOUT_MS
    while (this.buffer.length < length) {
      signal.throwIfAborted()
      const remaining = deadline - Date.now()
      if (remaining <= 0) throw new LinkTimeoutError()
      // Sleep until more data arrives, the deadline passes, or we're aborted.
      await new Promise<void>((resolve) => {
        const done = (): void => {
          clearTimeout(timer)
          signal.removeEventListener('abort', done)
          this.wake = null
          resolve()
        }
        const timer = setTimeout(done, remaining)
        signal.addEventListener('abort', done, { once: true })
        this.wake = done
      })
    }
    const out = this.buffer.slice(0, length)
    this.buffer = this.buffer.slice(length)
    return out
  }
}

export function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason)
      return
    }
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', onAbort, { once: true })
  })
}
