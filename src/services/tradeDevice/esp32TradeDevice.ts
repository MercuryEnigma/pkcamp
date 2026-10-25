import { i18n } from '../i18n'
import { Bridge as UpstreamBridge } from './vendor/gb-link-switch-ldn/bridge.js'
import { CableSession as UpstreamCableSession } from './vendor/gb-link-switch-ldn/cable/session.js'
import { EspDevice as UpstreamEspDevice } from './vendor/gb-link-switch-ldn/esp.js'
import { parseProdKeys } from './vendor/gb-link-switch-ldn/keys.js'
import { TradeSession as UpstreamTradeSession } from './vendor/gb-link-switch-ldn/trade/session.js'
import type { GbLinkRelayAdapter } from './gbLinkTradeDevice.ts'
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

/** GBA ↔ Switch link: `wireless` for FireRed/LeafGreen/Emerald, `cable` for Ruby/Sapphire. */
export type Esp32LinkKind = 'wireless' | 'cable'

/** The parts of the upstream `Bridge` and `CableSession` this device uses. */
export interface Esp32LinkSession extends EventTarget {
  start(): Promise<void>
  stop(): Promise<void>
  readonly cableOpen?: boolean
  readonly linked?: boolean
  readonly tradeReady?: boolean
  readonly switchNotReady?: boolean
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
  createLink(
    kind: Esp32LinkKind,
    device: Esp32Transport,
    adapter: GbLinkRelayAdapter
  ): Esp32LinkSession
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

const LinkClasses = {
  wireless: UpstreamBridge,
  cable: UpstreamCableSession,
} as unknown as Record<
  Esp32LinkKind,
  new (device: Esp32Transport, adapter: GbLinkRelayAdapter) => Esp32LinkSession
>

const defaultDependencies: Esp32TradeDeviceDependencies = {
  isSupported: () => EspDeviceClass.available(),
  requestPort: () => EspDeviceClass.requestPort(),
  createTransport: () => new EspDeviceClass(),
  createSession: (options) => new TradeSessionClass(options),
  createLink: (kind, device, adapter) => new LinkClasses[kind](device, adapter),
}

/** Negative when dotted version `a` is older than `b`. */
function compareVersions(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

function cloneParty(
  party: readonly (Uint8Array | null)[]
): (Uint8Array | null)[] {
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
      i18n.t(
        'services:esp32TradeDevice.anEsp32TradeNeedsSixPartySlotsAtLeastTwo'
      )
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
  private connecting: AbortController | null = null
  private disconnecting: Promise<void> | null = null

  constructor(
    dependencies: Esp32TradeDeviceDependencies = defaultDependencies
  ) {
    this.dependencies = dependencies
  }

  get supported(): boolean {
    return this.dependencies.isSupported()
  }

  get state(): TradeDeviceState {
    return this.currentState
  }

  async connect(options?: { signal?: AbortSignal }): Promise<void> {
    options?.signal?.throwIfAborted()
    if (this.transport?.attached) return
    if (!this.supported) {
      throw new TradeDeviceError(
        this.id,
        'unsupported',
        i18n.t('services:esp32TradeDevice.thisBrowserDoesNotSupportWebSerial')
      )
    }
    if (this.connecting || this.currentState !== 'disconnected') {
      throw new TradeDeviceError(
        this.id,
        'busy',
        i18n.t('services:esp32TradeDevice.theEsp32IsBusy')
      )
    }

    this.currentState = 'connecting'
    const controller = new AbortController()
    this.connecting = controller
    const cancel = () => controller.abort(options?.signal?.reason)
    options?.signal?.addEventListener('abort', cancel, { once: true })
    const transport = this.dependencies.createTransport()
    try {
      const port = await this.dependencies.requestPort()
      controller.signal.throwIfAborted()
      await transport.open(port)
      controller.signal.throwIfAborted()
      this.transport = transport
      this.currentState = 'connected'
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

  async disconnect(): Promise<void> {
    if (this.disconnecting) return this.disconnecting
    this.connecting?.abort()
    const transport = this.transport
    if (!transport) {
      this.currentState = 'disconnected'
      return
    }

    this.currentState = 'disconnecting'
    this.cancelTrade()
    this.transport = null
    this.disconnecting = Promise.resolve().then(async () => {
      try {
        await transport.close()
      } finally {
        this.currentState = 'disconnected'
        this.disconnecting = null
      }
    })
    return this.disconnecting
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
        i18n.t(
          'services:esp32TradeDevice.theProdKeysFileIsMissingOrHasAnInvalid',
          { value1: problems.join(', ') }
        )
      )
    }
    const rejected = await this.storeKeys(parsed.keys)
    if (rejected.length > 0) {
      throw new TradeDeviceError(
        this.id,
        'invalid-keys',
        i18n.t('services:esp32TradeDevice.theEsp32Rejected', {
          value1: rejected.join(', '),
        })
      )
    }
  }

  async trade(request: TradeRequest): Promise<TradeResult> {
    validateRequest(request)
    const transport = this.requireTransport()
    if (this.trading) {
      throw new TradeDeviceError(
        this.id,
        'busy',
        i18n.t('services:esp32TradeDevice.aTradeIsAlreadyRunning')
      )
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
          i18n.t(
            'services:esp32TradeDevice.theEsp32NeedsTheRequiredSwitchKeysBeforeTrading'
          )
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
      if (!this.disconnecting) {
        this.currentState = this.transport?.attached
          ? 'connected'
          : 'disconnected'
      }
    }
  }

  /**
   * Relays a live GBA ↔ Switch trade until `signal` aborts. Both players pick
   * their Pokémon on their own console; nothing is stored here.
   */
  async runLink(
    kind: Esp32LinkKind,
    adapter: GbLinkRelayAdapter,
    options: { signal: AbortSignal; onEvent?(event: TradeDeviceEvent): void }
  ): Promise<void> {
    const transport = this.requireTransport()
    if (this.trading) {
      throw new TradeDeviceError(
        this.id,
        'busy',
        i18n.t('services:esp32TradeDevice.aTradeIsAlreadyRunning')
      )
    }

    this.trading = true
    this.currentState = 'trading'
    const status = (message: string): void => {
      try {
        options.onEvent?.({ type: 'status', message })
      } catch {
        // A presentation callback must not interrupt the link.
      }
    }
    let session: Esp32LinkSession | null = null

    try {
      const keys = await transport.keyStatus()
      if (!keys?.complete) {
        throw new TradeDeviceError(
          this.id,
          'missing-keys',
          i18n.t(
            'services:esp32TradeDevice.theEsp32NeedsTheRequiredSwitchKeysBeforeTrading'
          )
        )
      }
      await transport.startBridge()
      const link = this.dependencies.createLink(kind, transport, adapter)
      session = link
      const failed = new Promise<never>((_, reject) => {
        link.addEventListener('failed', (event) => {
          const error = (event as CustomEvent<unknown>).detail
          reject(error instanceof Error ? error : new Error(String(error)))
        })
      })
      failed.catch(() => {})
      const aborted = new Promise<void>((resolve) => {
        if (options.signal.aborted) resolve()
        else
          options.signal.addEventListener('abort', () => resolve(), {
            once: true,
          })
      })
      if (kind === 'cable') {
        let last = ''
        link.addEventListener('change', () => {
          const message = link.switchNotReady
            ? i18n.t(
                'services:esp32TradeDevice.theSwitchSGameCanTTradeWithThisGba'
              )
            : link.tradeReady
              ? i18n.t('services:esp32TradeDevice.readyToTrade')
              : link.linked
                ? i18n.t('services:esp32TradeDevice.linkedToTheSwitchSRoom')
                : link.cableOpen
                  ? i18n.t('services:esp32TradeDevice.gbaCableLinkOpen')
                  : ''
          if (message && message !== last) status(message)
          last = message
        })
      }
      await Promise.race([link.start(), failed, aborted])
      if (kind === 'wireless')
        status(
          i18n.t('services:esp32TradeDevice.relayingBetweenTheGbaAndTheSwitch')
        )
      await Promise.race([aborted, failed])
    } finally {
      try {
        await session?.stop()
      } finally {
        this.trading = false
        if (!this.disconnecting) {
          this.currentState = this.transport?.attached
            ? 'connected'
            : 'disconnected'
        }
      }
    }
  }

  /**
   * Claims the board for a Mystery Gift group. The board needs its Switch
   * keys and firmware `minFirmware` or newer. `release()` frees it again.
   */
  async claimForGift(
    minFirmware: string,
    signal?: AbortSignal
  ): Promise<{
    transport: Esp32Transport
    signal: AbortSignal
    release(): void
  }> {
    signal?.throwIfAborted()
    const transport = this.requireTransport()
    if (this.trading) {
      throw new TradeDeviceError(
        this.id,
        'busy',
        i18n.t('services:esp32TradeDevice.theEsp32IsBusy')
      )
    }
    const version = transport.info?.version
    if (!version || compareVersions(version, minFirmware) < 0) {
      throw new TradeDeviceError(
        this.id,
        'unsupported',
        i18n.t(
          'services:esp32TradeDevice.mysteryGiftNeedsEsp32FirmwareOrNewer',
          {
            minFirmware: minFirmware,
            value2: version
              ? i18n.t('services:esp32TradeDevice.thisBoardHas', {
                  version: version,
                })
              : '',
          }
        )
      )
    }
    const controller = new AbortController()
    const cancel = () => controller.abort(signal?.reason)
    signal?.addEventListener('abort', cancel, { once: true })
    this.activeAbort = controller
    this.trading = true
    this.currentState = 'trading'
    const release = () => {
      signal?.removeEventListener('abort', cancel)
      if (this.activeAbort === controller) {
        this.activeAbort = null
        this.trading = false
        if (!this.disconnecting) {
          this.currentState = this.transport?.attached
            ? 'connected'
            : 'disconnected'
        }
      }
    }
    try {
      const keys = await transport.keyStatus()
      controller.signal.throwIfAborted()
      if (!keys?.complete) {
        throw new TradeDeviceError(
          this.id,
          'missing-keys',
          i18n.t(
            'services:esp32TradeDevice.theEsp32NeedsYourSwitchKeysAddProdKeysOn'
          )
        )
      }
      await transport.startBridge()
      controller.signal.throwIfAborted()
      return { transport, signal: controller.signal, release }
    } catch (cause) {
      release()
      throw cause
    }
  }

  offerSlot(slot: number): void {
    if (!this.activeSession) {
      throw new TradeDeviceError(
        this.id,
        'not-connected',
        i18n.t('services:esp32TradeDevice.noTradeIsActive')
      )
    }
    this.activeSession.offerSlot(slot)
  }

  declineTrade(): void {
    if (!this.activeSession) {
      throw new TradeDeviceError(
        this.id,
        'not-connected',
        i18n.t('services:esp32TradeDevice.noTradeIsActive')
      )
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
        i18n.t('services:esp32TradeDevice.connectTheEsp32BeforeTrading')
      )
    }
    return this.transport
  }
}
