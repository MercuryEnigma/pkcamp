import {
  readGbaBios,
  readGbaRom,
  readGbaSave,
  writeGbaSave,
  type GbaDumperOptions,
  type GbaSaveOptions,
  type WriteGbaSaveOptions,
} from '../gbaSaveDump/readGbaSave.ts'
import { toWire as pk3ToWire } from './vendor/gb-link-switch-ldn/trade/pk3.js'
import {
  GB_LINK_COMMAND,
  GB_LINK_MODE,
  GB_LINK_MAX_PAYLOAD,
  GB_LINK_SERIAL_CHANNEL,
  GB_LINK_STATUS,
  GbLinkSerialFrameDecoder,
  encodeGbLinkSerialFrame,
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

/** Relay surface used to bridge an ESP32 to the GB-Link (GBA-Switch trading). */
export interface GbLinkRelayAdapter {
  /** Every status and data frame the GB-Link sends, as a GB-framed byte stream. */
  onBytes: ((bytes: Uint8Array) => void) | null
  /** Every status and data frame the GB-Link sends, unframed. */
  onFrame: ((channel: number, payload: Uint8Array) => void) | null
  /** Takes a GB-framed byte stream and forwards each frame, in order. */
  writeStream(bytes: Uint8Array): Promise<void>
  setMode(mode: number): Promise<void>
  /** `payload[0]` is the command byte. */
  sendCommand(payload: ArrayLike<number>): Promise<void>
  sendData(payload: Uint8Array): Promise<void>
  /** Sends Cancel; never rejects. */
  leaveMode(): Promise<void>
}

export interface GbLinkRelayLease {
  adapter: GbLinkRelayAdapter
  /** Sends Cancel, detaches listeners and frees the device. Safe to repeat. */
  release(): Promise<void>
}

const FIRMWARE_REPLY_TIMEOUT_MS = 800

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
  private cachedFirmware: string | null = null
  private connecting: AbortController | null = null
  private disconnecting: Promise<void> | null = null
  private removeDetach: (() => void) | null = null

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

  async connect(options?: {
    previouslyGrantedOnly?: boolean
    signal?: AbortSignal
  }): Promise<void> {
    options?.signal?.throwIfAborted()
    if (this.transport?.attached) return
    // The last link dropped without a disconnect: release it, then reconnect.
    if (this.transport && !this.disconnecting) await this.disconnect()
    options?.signal?.throwIfAborted()
    if (!this.supported) {
      throw new TradeDeviceError(
        this.id,
        'unsupported',
        'This browser supports neither WebUSB nor Web Serial.'
      )
    }
    if (this.connecting || this.currentState !== 'disconnected') {
      throw new TradeDeviceError(this.id, 'busy', 'The GB-Link is busy.')
    }

    this.currentState = 'connecting'
    const controller = new AbortController()
    this.connecting = controller
    const cancel = () => controller.abort(options?.signal?.reason)
    options?.signal?.addEventListener('abort', cancel, { once: true })
    const transport = this.dependencies.createTransport()
    try {
      await transport.open({ ...options, signal: controller.signal })
      controller.signal.throwIfAborted()
      this.transport = transport
      this.currentState = 'connected'
      this.removeDetach =
        transport.onDetach?.(() => {
          if (this.transport === transport)
            void this.disconnect().catch(() => {})
        }) ?? null
    } catch (error) {
      try {
        await transport.close()
      } finally {
        this.currentState = 'disconnected'
      }
      throw error
    } finally {
      options?.signal?.removeEventListener('abort', cancel)
      this.connecting = null
    }
  }

  /** Firmware version read earlier on this connection, if any. */
  get knownFirmwareVersion(): string | null {
    return this.cachedFirmware
  }

  /** Asks the adapter for its firmware version; null if it does not answer. */
  async firmwareVersion(): Promise<string | null> {
    if (this.cachedFirmware) return this.cachedFirmware
    const transport = this.requireTransport()
    const version = await new Promise<string | null>((resolve) => {
      const finish = (value: string | null): void => {
        clearTimeout(timer)
        removeListener()
        resolve(value)
      }
      const removeListener = transport.onData((payload) => {
        if (
          payload[0] === GB_LINK_COMMAND.getFirmwareInfo &&
          payload.length >= 4
        ) {
          finish(`${payload[1]}.${payload[2]}.${payload[3]}`)
        }
      })
      const timer = setTimeout(() => finish(null), FIRMWARE_REPLY_TIMEOUT_MS)
      transport
        .sendCommand(GB_LINK_COMMAND.getFirmwareInfo)
        .catch(() => finish(null))
    })
    if (version && this.transport === transport) this.cachedFirmware = version
    return version
  }

  /** Resets the adapter into its USB bootloader; the device then disappears. */
  async rebootToBootloader(): Promise<void> {
    const transport = this.requireTransport()
    await transport.sendCommand(GB_LINK_COMMAND.rebootBootloader)
    this.cancelTrade()
    this.removeDetach?.()
    this.removeDetach = null
    this.transport = null
    this.cachedFirmware = null
    this.currentState = 'disconnected'
    await transport.close()
  }

  async disconnect(): Promise<void> {
    if (this.disconnecting) return this.disconnecting
    this.connecting?.abort()
    this.cachedFirmware = null
    const transport = this.transport
    if (!transport) {
      this.currentState = 'disconnected'
      return
    }

    this.currentState = 'disconnecting'
    this.cancelTrade()
    this.removeDetach?.()
    this.removeDetach = null
    this.transport = null
    this.disconnecting = Promise.resolve().then(async () => {
      try {
        if (transport.attached) {
          await transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {})
        }
        await transport.close()
      } finally {
        this.currentState = 'disconnected'
        this.disconnecting = null
      }
    })
    return this.disconnecting
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
      if (!this.disconnecting) {
        this.currentState =
          this.transport === transport && transport.attached
            ? 'connected'
            : 'disconnected'
      }
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

  /** Reads the cartridge ROM in the connected GBA. */
  readRom(options: GbaSaveOptions): Promise<Uint8Array> {
    return this.runExclusive(options.signal, (transport, signal) =>
      readGbaRom(transport, { ...options, signal })
    )
  }

  /** Reads the BIOS of the connected GBA. */
  readBios(options: GbaDumperOptions): Promise<Uint8Array> {
    return this.runExclusive(options.signal, (transport, signal) =>
      readGbaBios(transport, { ...options, signal })
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
    const lease = this.acquire(signal)
    try {
      return await operation(lease.transport, lease.signal)
    } finally {
      lease.free()
    }
  }

  /**
   * Claims the device for a caller that drives the transport itself, such as
   * a Mystery Gift distribution. `free()` releases it; the caller leaves any
   * mode it set.
   */
  claim(signal: AbortSignal): {
    transport: GbLinkTransport
    signal: AbortSignal
    free(): void
  } {
    return this.acquire(signal)
  }

  /**
   * Claims the device for a GBA-Switch relay. Aborting `signal` or calling
   * `release()` sends Cancel and frees the device for other operations.
   */
  linkAdapter(signal: AbortSignal): Promise<GbLinkRelayLease> {
    return Promise.resolve().then(() => {
      const lease = this.acquire(signal)
      const { transport } = lease
      const adapter: GbLinkRelayAdapter = {
        onBytes: null,
        onFrame: null,
        writeStream: (bytes) => {
          const sends = decoder
            .push(bytes)
            .map(
              (frame) => () =>
                frame.channel === GB_LINK_SERIAL_CHANNEL.command
                  ? transport.sendCommand(
                      frame.payload[0],
                      frame.payload.slice(1)
                    )
                  : transport.sendData(frame.payload)
            )
          for (const send of sends) queue = queue.then(send)
          const done = queue
          queue = queue.catch(() => {})
          return done
        },
        setMode: (mode) =>
          transport.sendCommand(
            GB_LINK_COMMAND.setMode,
            new Uint8Array([mode])
          ),
        sendCommand: (payload) =>
          transport.sendCommand(
            payload[0],
            Uint8Array.from(Array.from(payload).slice(1))
          ),
        sendData: (payload) => transport.sendData(payload),
        leaveMode: () =>
          transport.sendCommand(GB_LINK_COMMAND.cancel).catch(() => {}),
      }
      const decoder = new GbLinkSerialFrameDecoder()
      let queue: Promise<void> = Promise.resolve()
      const removeListener = transport.onFrame((channel, payload) => {
        adapter.onFrame?.(channel, payload)
        if (adapter.onBytes && payload.length <= GB_LINK_MAX_PAYLOAD) {
          adapter.onBytes(encodeGbLinkSerialFrame(channel, payload))
        }
      })

      let released: Promise<void> | null = null
      const release = (): Promise<void> => {
        released ??= (async () => {
          lease.signal.removeEventListener('abort', onAbort)
          removeListener()
          adapter.onBytes = null
          adapter.onFrame = null
          if (transport.attached) await adapter.leaveMode()
          lease.free()
        })()
        return released
      }
      const onAbort = (): void => void release()
      if (lease.signal.aborted) onAbort()
      else lease.signal.addEventListener('abort', onAbort, { once: true })
      return { adapter, release }
    })
  }

  /** Marks the device busy; the caller must call `free()` when done. */
  private acquire(signal: AbortSignal): {
    transport: GbLinkTransport
    signal: AbortSignal
    free(): void
  } {
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
    return {
      transport,
      signal: controller.signal,
      free: () => {
        signal.removeEventListener('abort', cancel)
        if (this.activeAbort === controller) {
          this.activeAbort = null
          if (!this.disconnecting) {
            this.currentState =
              this.transport === transport && transport.attached
                ? 'connected'
                : 'disconnected'
          }
        }
      },
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
