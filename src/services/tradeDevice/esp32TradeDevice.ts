import { EspDevice as UpstreamEspDevice } from './vendor/gb-link-switch-ldn/esp.js'
import { parseProdKeys } from './vendor/gb-link-switch-ldn/keys.js'
import { TradeSession as UpstreamTradeSession } from './vendor/gb-link-switch-ldn/trade/session.js'
import {
  TradeDeviceError,
  type CompletedTrade,
  type TradeDevice,
  type TradeDeviceEvent,
  type TradeDeviceState,
  type TradeRequest,
  type TradeResult,
} from './types.ts'

export interface Esp32KeyStatus {
  complete: boolean
  [name: string]: boolean
}

export interface Esp32Transport {
  attached: boolean
  info?: { chip?: string; version?: string } | null
  hearsUnreadableRoom: boolean
  onAdapterFrame: ((payload: Uint8Array) => void) | null
  open(port: unknown): Promise<void>
  close(): Promise<unknown>
  command(text: string, timeoutMs?: number): Promise<string[]>
  sendAdapter(bytes: Uint8Array): void
  bridgeStatus(): Promise<Record<string, string> | null>
  keyStatus(): Promise<Esp32KeyStatus | null>
  storeKeys(keys: Record<string, string>): Promise<string[]>
  startBridge(): Promise<void>
}

interface UpstreamTradeEvent {
  event: string
  message?: string
  tone?: string
  model?: string
  firmware?: string
  name?: string
  party?: (Uint8Array | null)[]
  slot?: number
  taken?: boolean
  value?: boolean
  traded?: number
  pk3?: Uint8Array
}

export interface Esp32TradeSession {
  run(signal?: AbortSignal): Promise<void>
  offerSlot(slot: number): void
  declineTrade(): void
}

export interface Esp32TradeDeviceDependencies {
  isSupported(): boolean
  requestPort(): Promise<unknown>
  createTransport(): Esp32Transport
  createSession(options: {
    device: Esp32Transport
    party: (Uint8Array | null)[]
    selected: number
    emit(event: UpstreamTradeEvent): void
  }): Esp32TradeSession
}

const EspDeviceClass = UpstreamEspDevice as unknown as {
  available(): boolean
  requestPort(): Promise<unknown>
  new (): Esp32Transport
}

const TradeSessionClass = UpstreamTradeSession as unknown as new (options: {
  device: Esp32Transport
  party: (Uint8Array | null)[]
  selected: number
  emit(event: UpstreamTradeEvent): void
}) => Esp32TradeSession

const defaultDependencies: Esp32TradeDeviceDependencies = {
  isSupported: () => EspDeviceClass.available(),
  requestPort: () => EspDeviceClass.requestPort(),
  createTransport: () => new EspDeviceClass(),
  createSession: (options) => new TradeSessionClass(options),
}

function cloneParty(party: readonly (Uint8Array | null)[]): (Uint8Array | null)[] {
  return party.map((pokemon) => pokemon?.slice() ?? null)
}

function validateRequest(request: TradeRequest): void {
  const { party, selectedSlot } = request
  const occupied = party.filter(Boolean).length
  if (
    party.length !== 6 ||
    occupied < 2 ||
    !Number.isInteger(selectedSlot) ||
    selectedSlot < 0 ||
    selectedSlot >= party.length ||
    !party[selectedSlot]
  ) {
    throw new TradeDeviceError(
      'esp32',
      'invalid-party',
      'An ESP32 trade needs six party slots, at least two Pokémon, and an occupied selected slot.'
    )
  }
}

/**
 * FireRed/LeafGreen PC-to-Switch trading through an ESP32 running the
 * GB-Link-Switch-LDN bridge firmware.
 */
export class Esp32TradeDevice implements TradeDevice {
  readonly id = 'esp32'
  readonly label = 'ESP32'
  readonly implemented = true

  private readonly dependencies: Esp32TradeDeviceDependencies
  private transport: Esp32Transport | null = null
  private currentState: TradeDeviceState = 'disconnected'
  private activeSession: Esp32TradeSession | null = null
  private activeAbort: AbortController | null = null
  private trading = false

  constructor(dependencies: Esp32TradeDeviceDependencies = defaultDependencies) {
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
        'This browser does not support Web Serial.'
      )
    }
    if (this.currentState !== 'disconnected') {
      throw new TradeDeviceError(this.id, 'busy', 'The ESP32 is busy.')
    }

    this.currentState = 'connecting'
    const transport = this.dependencies.createTransport()
    try {
      const port = await this.dependencies.requestPort()
      await transport.open(port)
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
      await transport.close()
    } finally {
      this.currentState = 'disconnected'
    }
  }

  async keyStatus(): Promise<Esp32KeyStatus | null> {
    return this.requireTransport().keyStatus()
  }

  async storeKeys(keys: Record<string, string>): Promise<string[]> {
    const transport = this.requireTransport()
    const rejected = await transport.storeKeys(keys)
    if (rejected.length === 0) await transport.startBridge()
    return rejected
  }

  async storeProdKeys(contents: string): Promise<void> {
    const parsed = parseProdKeys(contents)
    const problems = [...parsed.missing, ...parsed.malformed]
    if (problems.length > 0) {
      throw new TradeDeviceError(
        this.id,
        'invalid-keys',
        `The prod.keys file is missing or has an invalid value for: ${problems.join(', ')}.`
      )
    }
    const rejected = await this.storeKeys(parsed.keys)
    if (rejected.length > 0) {
      throw new TradeDeviceError(
        this.id,
        'invalid-keys',
        `The ESP32 rejected: ${rejected.join(', ')}.`
      )
    }
  }

  async trade(request: TradeRequest): Promise<TradeResult> {
    validateRequest(request)
    const transport = this.requireTransport()
    if (this.trading) {
      throw new TradeDeviceError(this.id, 'busy', 'A trade is already running.')
    }

    this.trading = true
    this.currentState = 'trading'
    const controller = new AbortController()
    this.activeAbort = controller
    const cancel = (): void => controller.abort(request.signal?.reason)
    if (request.signal?.aborted) cancel()
    else request.signal?.addEventListener('abort', cancel, { once: true })

    const party = cloneParty(request.party)
    const trades: CompletedTrade[] = []
    let autoOfferPending = request.autoOffer !== false
    let session: Esp32TradeSession

    const notify = (event: TradeDeviceEvent): void => {
      try {
        request.onEvent?.(event)
      } catch {
        // A presentation callback must not interrupt the timing-sensitive link.
      }
    }

    const onEvent = (event: UpstreamTradeEvent): void => {
      switch (event.event) {
        case 'phase':
          notify({
            type: 'status',
            message: event.message ?? '',
            tone: event.tone,
          })
          break
        case 'log':
          notify({ type: 'log', message: event.message ?? '' })
          break
        case 'device':
          notify({
            type: 'device',
            model: event.model,
            firmware: event.firmware,
          })
          break
        case 'opponent_party':
          notify({
            type: 'opponent-party',
            name: event.name ?? 'Switch',
            party: cloneParty(event.party ?? []),
          })
          break
        case 'menu':
          notify({ type: 'menu-open' })
          if (autoOfferPending) {
            autoOfferPending = false
            session.offerSlot(request.selectedSlot)
          }
          break
        case 'offer':
          notify({
            type: 'offer',
            slot: event.slot ?? request.selectedSlot,
            accepted: Boolean(event.taken),
          })
          break
        case 'trading':
          notify({ type: 'trade-started' })
          break
        case 'declining':
          notify({ type: 'declining', value: Boolean(event.value) })
          break
        case 'room':
          notify({ type: 'room', trades: event.traded ?? trades.length })
          break
        case 'received': {
          const slot = event.slot ?? request.selectedSlot
          if (!event.pk3 || slot < 0 || slot >= party.length) break
          const sent = party[slot]
          if (!sent) break
          const received = event.pk3.slice()
          trades.push({ slot, sent: sent.slice(), received })
          party[slot] = received.slice()
          notify({ type: 'trade-completed', slot, received: received.slice() })
          break
        }
      }
    }

    try {
      const keys = await transport.keyStatus()
      if (!keys?.complete) {
        throw new TradeDeviceError(
          this.id,
          'missing-keys',
          'The ESP32 needs the required Switch keys before trading.'
        )
      }
      await transport.startBridge()
      session = this.dependencies.createSession({
        device: transport,
        party: cloneParty(party),
        selected: request.selectedSlot,
        emit: onEvent,
      })
      this.activeSession = session
      await session.run(controller.signal)
      return { trades, party: cloneParty(party) }
    } finally {
      request.signal?.removeEventListener('abort', cancel)
      this.activeSession = null
      this.activeAbort = null
      this.trading = false
      this.currentState = this.transport?.attached
        ? 'connected'
        : 'disconnected'
    }
  }

  offerSlot(slot: number): void {
    if (!this.activeSession) {
      throw new TradeDeviceError(this.id, 'not-connected', 'No trade is active.')
    }
    this.activeSession.offerSlot(slot)
  }

  declineTrade(): void {
    if (!this.activeSession) {
      throw new TradeDeviceError(this.id, 'not-connected', 'No trade is active.')
    }
    this.activeSession.declineTrade()
  }

  cancelTrade(): void {
    this.activeAbort?.abort()
  }

  private requireTransport(): Esp32Transport {
    if (!this.transport?.attached) {
      throw new TradeDeviceError(
        this.id,
        'not-connected',
        'Connect the ESP32 before trading.'
      )
    }
    return this.transport
  }
}
