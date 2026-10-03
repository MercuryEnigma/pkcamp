import {
  readGbaSave,
  writeGbaSave,
  type GbaSaveOptions,
  type WriteGbaSaveOptions,
} from '../gbaSaveDump/readGbaSave.ts'
import { toWire as pk3ToWire } from './vendor/gb-link-switch-ldn/trade/pk3.js'
import {
  GB_LINK_COMMAND,
  GB_LINK_MODE,
  GB_LINK_STATUS,
} from './gbLinkProtocol.ts'
import {
  BrowserGbLinkTransport,
  type GbLinkTransport,
} from './gbLinkTransport.ts'
import {
  TradeDeviceError,
  type TradeDevice,
  type TradeDeviceEvent,
  type TradeDeviceState,
  type TradeRequest,
  type TradeResult,
} from './types.ts'

export interface GbLinkTradeDeviceDependencies {
  isSupported(): boolean
  createTransport(): GbLinkTransport
  /** PK3 (decrypted) to the 100-byte encrypted link record. */
  encodePokemon(bytes: Uint8Array): Uint8Array
  readyTimeoutMs?: number
  sessionTimeoutMs?: number
}

const defaultDependencies: GbLinkTradeDeviceDependencies = {
  isSupported: () => BrowserGbLinkTransport.available(),
  createTransport: () => new BrowserGbLinkTransport(),
  encodePokemon: (bytes) => pk3ToWire(bytes),
  readyTimeoutMs: 2500,
  sessionTimeoutMs: 15 * 60 * 1000,
}

function cloneParty(
  party: readonly (Uint8Array | null)[]
): (Uint8Array | null)[] {
  return party.map((pokemon) => pokemon?.slice() ?? null)
}

function validateRequest(request: TradeRequest): void {
  if (
    request.party.length !== 6 ||
    !Number.isInteger(request.selectedSlot) ||
    request.selectedSlot < 0 ||
    request.selectedSlot >= request.party.length ||
    !request.party[request.selectedSlot]
  ) {
    throw new TradeDeviceError(
      'gb-link',
      'invalid-party',
      'A GB-Link trade needs six party slots and an occupied selected slot.'
    )
  }
}

function waitForStatus(
  transport: GbLinkTransport,
  expected: number,
  timeoutMs: number,
  signal: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: unknown): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      removeStatusListener()
      signal.removeEventListener('abort', onAbort)
      if (error) reject(error)
      else resolve()
    }
    const removeStatusListener = transport.onStatus((status) => {
      if (status === expected) finish()
    })
    const onAbort = (): void =>
      finish(
        signal.reason ??
          new DOMException('The trade was cancelled.', 'AbortError')
      )
    const timer = setTimeout(
      () => finish(new Error('Timed out waiting for the GB-Link adapter.')),
      timeoutMs
    )

    if (signal.aborted) onAbort()
    else signal.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * Generation 3 trade-partner emulation using stock GB-Link firmware.
 *
 * Stock firmware reports that the session finished but never returns the
 * Pokémon received from the GBA, so `trade()` emits
 * `hardware-trade-finished { receivedAvailable: false }` and resolves with no
 * completed trades and the party unchanged. The route layer decides what to
 * show the user in place of the unknown Pokémon.
 */
export class GbLinkTradeDevice implements TradeDevice {
  readonly id = 'gb-link'
  readonly label = 'GB-Link'
  readonly implemented = true

  private readonly dependencies: GbLinkTradeDeviceDependencies
  private transport: GbLinkTransport | null = null
  private currentState: TradeDeviceState = 'disconnected'
  private activeAbort: AbortController | null = null

  constructor(
    dependencies: GbLinkTradeDeviceDependencies = defaultDependencies
  ) {
    this.dependencies = dependencies
  }

  get supported(): boolean {
    return this.dependencies.isSupported()
  }

  get state(): TradeDeviceState {
    return this.currentState
  }

  async connect(): Promise<void> {
    if (this.transport?.attached) return
    if (!this.supported) {
      throw new TradeDeviceError(
        this.id,
        'unsupported',
        'This browser supports neither WebUSB nor Web Serial.'
      )
    }
    if (this.currentState !== 'disconnected') {
      throw new TradeDeviceError(this.id, 'busy', 'The GB-Link is busy.')
    }

    this.currentState = 'connecting'
    const transport = this.dependencies.createTransport()
    try {
      await transport.open()
      this.transport = transport
      this.currentState = 'connected'
    } catch (error) {
      await transport.close()
      this.currentState = 'disconnected'
      throw error
    }
  }

  async disconnect(): Promise<void> {
    const transport = this.transport
    if (!transport) {
      this.currentState = 'disconnected'
      return
    }

    this.currentState = 'disconnecting'
    this.cancelTrade()
    this.transport = null
    try {
      if (transport.attached) {
        await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
      }
      await transport.close()
    } finally {
      this.currentState = 'disconnected'
    }
  }

  async trade(request: TradeRequest): Promise<TradeResult> {
    validateRequest(request)
    const transport = this.requireTransport()
    if (this.activeAbort) {
      throw new TradeDeviceError(
        this.id,
        'busy',
        'A GB-Link trade is already running.'
      )
    }

    const controller = new AbortController()
    this.activeAbort = controller
    this.currentState = 'trading'
    const cancel = (): void => controller.abort(request.signal?.reason)
    if (request.signal?.aborted) cancel()
    else request.signal?.addEventListener('abort', cancel, { once: true })

    const notify = (event: TradeDeviceEvent): void => {
      try {
        request.onEvent?.(event)
      } catch {
        // A presentation callback must not interrupt the hardware session.
      }
    }

    const removeSessionListener = transport.onStatus((status) => {
      if (status === GB_LINK_STATUS.emulationSessionStarted) {
        notify({ type: 'trade-started' })
      }
    })

    try {
      notify({ type: 'status', message: 'Preparing the GB-Link adapter.' })
      const ready = waitForStatus(
        transport,
        GB_LINK_STATUS.deviceReady,
        this.dependencies.readyTimeoutMs ?? 2500,
        controller.signal
      )
      await transport.sendCommand(GB_LINK_COMMAND.cancel)
      await transport.sendCommand(
        GB_LINK_COMMAND.setMode,
        new Uint8Array([GB_LINK_MODE.tradeEmulation])
      )
      await ready

      const finished = waitForStatus(
        transport,
        GB_LINK_STATUS.tradeSessionFinished,
        this.dependencies.sessionTimeoutMs ?? 15 * 60 * 1000,
        controller.signal
      )
      // Upload six copies of the selected Pokémon: whichever firmware slot the
      // GBA's pick swaps, it is always the selected one. Other slots are ignored.
      const selected = request.party[request.selectedSlot]!
      const wireBytes = this.dependencies.encodePokemon(selected)
      if (wireBytes.length !== 100) {
        throw new Error('GB-Link Pokémon data must be 100 bytes.')
      }
      for (let copy = 0; copy < 6; copy++) {
        await transport.sendData(wireBytes.slice(0, 50))
        await transport.sendData(wireBytes.slice(50, 100))
      }

      notify({
        type: 'status',
        message: 'Choose the Pokémon on the connected Game Boy Advance.',
      })
      await finished

      // Stock firmware: 0xFF09 is treated as trade completed.
      notify({ type: 'hardware-trade-finished', receivedAvailable: false })
      return { trades: [], party: cloneParty(request.party) }
    } catch (error) {
      await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
      throw error
    } finally {
      removeSessionListener()
      request.signal?.removeEventListener('abort', cancel)
      this.activeAbort = null
      this.currentState = transport.attached ? 'connected' : 'disconnected'
    }
  }

  /**
   * Reads the cartridge save from the connected GBA. Shares this device's
   * connection, since WebUSB lets only one owner claim the GB-Link.
   */
  readSave(options: GbaSaveOptions): Promise<Uint8Array> {
    return this.runExclusive(options.signal, (transport, signal) =>
      readGbaSave(transport, { ...options, signal })
    )
  }

  /** Overwrites the cartridge save in the connected GBA. */
  writeSave(options: WriteGbaSaveOptions): Promise<void> {
    return this.runExclusive(options.signal, (transport, signal) =>
      writeGbaSave(transport, { ...options, signal })
    )
  }

  /** Runs a cartridge operation while no trade or other operation is active. */
  private async runExclusive<T>(
    signal: AbortSignal,
    operation: (transport: GbLinkTransport, signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const transport = this.requireTransport()
    if (this.activeAbort) {
      throw new TradeDeviceError(this.id, 'busy', 'The GB-Link is busy.')
    }
    const controller = new AbortController()
    this.activeAbort = controller
    this.currentState = 'trading'
    const cancel = (): void => controller.abort(signal.reason)
    if (signal.aborted) cancel()
    else signal.addEventListener('abort', cancel, { once: true })
    try {
      return await operation(transport, controller.signal)
    } finally {
      signal.removeEventListener('abort', cancel)
      this.activeAbort = null
      this.currentState = transport.attached ? 'connected' : 'disconnected'
    }
  }

  offerSlot(_slot: number): void {
    // The user chooses the offered Pokémon on the physical GBA.
  }

  declineTrade(): void {
    this.cancelTrade()
  }

  cancelTrade(): void {
    this.activeAbort?.abort()
  }

  private requireTransport(): GbLinkTransport {
    if (!this.transport?.attached) {
      throw new TradeDeviceError(
        this.id,
        'not-connected',
        'Connect the GB-Link before trading.'
      )
    }
    return this.transport
  }
}
