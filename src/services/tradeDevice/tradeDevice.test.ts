import { describe, expect, it, vi } from 'vitest'
import {
  createTradeDeviceService,
  Esp32TradeDevice,
  TradeDeviceError,
  type Esp32LinkSession,
  type Esp32TradeDeviceDependencies,
  type Esp32TradeSession,
  type Esp32Transport,
  type TradeDeviceEvent,
} from './index.ts'
import type { GbLinkRelayAdapter } from './gbLinkTradeDevice.ts'
import { GbLinkTradeDevice as ImplementedGbLinkTradeDevice } from './gbLinkTradeDevice.ts'

function pokemon(value: number): Uint8Array {
  return new Uint8Array([value])
}

function makeDependencies(options?: { keysComplete?: boolean }): {
  dependencies: Esp32TradeDeviceDependencies
  transport: Esp32Transport
  sessions: Esp32TradeSession[]
  links: (Esp32LinkSession & {
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    kind: string
    adapter: unknown
  })[]
} {
  const sessions: Esp32TradeSession[] = []
  const links: ReturnType<typeof makeDependencies>['links'] = []
  const transport: Esp32Transport = {
    attached: false,
    info: { chip: 'esp32s3', version: '2.0.0' },
    hearsUnreadableRoom: false,
    onAdapterFrame: null,
    async open() {
      this.attached = true
    },
    async close() {
      this.attached = false
    },
    async keyStatus() {
      return { complete: options?.keysComplete !== false }
    },
    command: vi.fn(async () => []),
    sendAdapter: vi.fn(),
    bridgeStatus: vi.fn(async () => null),
    storeKeys: vi.fn(async () => []),
    startBridge: vi.fn(async () => {}),
  }

  const dependencies: Esp32TradeDeviceDependencies = {
    isSupported: () => true,
    requestPort: async () => ({ id: 'test-port' }),
    createTransport: () => transport,
    createLink: (kind, _device, adapter) => {
      const link = Object.assign(new EventTarget(), {
        start: vi.fn(async () => {}),
        stop: vi.fn(async () => {}),
        kind,
        adapter,
      })
      links.push(link)
      return link
    },
    createSession: ({ emit }) => {
      const session: Esp32TradeSession = {
        offerSlot: vi.fn((slot: number) => {
          emit({ event: 'offer', slot, taken: true })
        }),
        declineTrade: vi.fn(),
        async run() {
          emit({ event: 'device', model: 'esp32s3', firmware: '2.0.0' })
          emit({ event: 'menu' })
          emit({ event: 'trading' })
          emit({ event: 'received', slot: 0, pk3: pokemon(9) })
        },
      }
      sessions.push(session)
      return session
    },
  }

  return { dependencies, transport, sessions, links }
}

describe('TradeDeviceService', () => {
  it('registers the hardware and local trade devices', () => {
    const { dependencies } = makeDependencies()
    const service = createTradeDeviceService({ esp32: dependencies })

    expect(service.list().map(({ id }) => id)).toEqual([
      'esp32',
      'gb-link',
      'save-backup',
      'camp-site',
    ])
    expect(service.get('save-backup').implemented).toBe(true)
    expect(service.get('camp-site').implemented).toBe(true)
    expect(service.get('esp32').implemented).toBe(true)
    expect(service.get('gb-link')).toBeInstanceOf(ImplementedGbLinkTradeDevice)
    expect(service.get('gb-link').implemented).toBe(true)
  })
})

describe('Esp32TradeDevice', () => {
  it('shares a pending disconnect and blocks a second connection during cleanup', async () => {
    const { dependencies, transport } = makeDependencies()
    const device = new Esp32TradeDevice(dependencies)
    await device.connect()
    let finish!: () => void
    const closing = new Promise<void>((resolve) => {
      finish = resolve
    })
    const close = vi
      .spyOn(transport, 'close')
      .mockImplementationOnce(async () => {
        await closing
        transport.attached = false
      })
    const first = device.disconnect()
    const second = device.disconnect()
    await expect(device.connect()).rejects.toMatchObject({ code: 'busy' })
    expect(device.state).toBe('disconnecting')
    finish()
    await Promise.all([first, second])
    expect(close).toHaveBeenCalledOnce()
    expect(device.state).toBe('disconnected')
  })

  it.each(['cancel', 'disconnect'] as const)(
    'does not open a late ESP32 selection after %s',
    async (action) => {
      const { dependencies, transport } = makeDependencies()
      let choose!: (port: unknown) => void
      const chosen = new Promise<unknown>((resolve) => {
        choose = resolve
      })
      dependencies.requestPort = () => chosen
      const open = vi.spyOn(transport, 'open')
      const device = new Esp32TradeDevice(dependencies)
      const controller = new AbortController()
      const connecting = device.connect({ signal: controller.signal })
      const rejected = expect(connecting).rejects.toMatchObject({
        name: 'AbortError',
      })
      if (action === 'cancel') controller.abort()
      else await device.disconnect()
      await expect(device.connect()).rejects.toMatchObject({ code: 'busy' })
      choose({ id: 'late-port' })
      await rejected
      expect(open).not.toHaveBeenCalled()
      expect(device.state).toBe('disconnected')
    }
  )

  it('releases a gift reservation cancelled while checking keys', async () => {
    const { dependencies, transport } = makeDependencies()
    transport.info!.version = '2.1.0'
    let checked!: (keys: { complete: boolean }) => void
    const keys = new Promise<{ complete: boolean }>((resolve) => {
      checked = resolve
    })
    vi.spyOn(transport, 'keyStatus').mockReturnValueOnce(keys)
    const device = new Esp32TradeDevice(dependencies)
    await device.connect()
    const controller = new AbortController()
    const claim = device.claimForGift('2.1.0', controller.signal)
    const rejected = expect(claim).rejects.toMatchObject({ name: 'AbortError' })
    await expect(device.claimForGift('2.1.0')).rejects.toMatchObject({
      code: 'busy',
    })
    controller.abort()
    checked({ complete: true })
    await rejected
    expect(transport.startBridge).not.toHaveBeenCalled()
    expect(device.state).toBe('connected')
  })

  it('connects and runs a TradeSession with an automatic first offer', async () => {
    const { dependencies, transport, sessions } = makeDependencies()
    const device = new Esp32TradeDevice(dependencies)
    const events: TradeDeviceEvent[] = []

    await device.connect()
    const result = await device.trade({
      party: [pokemon(1), pokemon(2), null, null, null, null],
      selectedSlot: 0,
      onEvent: (event) => events.push(event),
    })

    expect(transport.startBridge).toHaveBeenCalledOnce()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].offerSlot).toHaveBeenCalledWith(0)
    expect(result.trades).toEqual([
      { slot: 0, sent: pokemon(1), received: pokemon(9) },
    ])
    expect(result.party[0]).toEqual(pokemon(9))
    expect(events.map(({ type }) => type)).toEqual([
      'device',
      'menu-open',
      'offer',
      'trade-started',
      'trade-completed',
    ])
    expect(device.state).toBe('connected')
  })

  it('rejects a party with fewer than two Pokemon', async () => {
    const { dependencies } = makeDependencies()
    const device = new Esp32TradeDevice(dependencies)
    await device.connect()

    await expect(
      device.trade({
        party: [pokemon(1), null, null, null, null, null],
        selectedSlot: 0,
      })
    ).rejects.toMatchObject({
      code: 'invalid-party',
    } satisfies Partial<TradeDeviceError>)
  })

  it('requires Switch keys before starting TradeSession', async () => {
    const { dependencies, sessions } = makeDependencies({ keysComplete: false })
    const device = new Esp32TradeDevice(dependencies)
    await device.connect()

    await expect(
      device.trade({
        party: [pokemon(1), pokemon(2), null, null, null, null],
        selectedSlot: 0,
      })
    ).rejects.toMatchObject({
      code: 'missing-keys',
    } satisfies Partial<TradeDeviceError>)
    expect(sessions).toHaveLength(0)
    expect(device.state).toBe('connected')
  })

  it('validates and stores an uploaded prod.keys file', async () => {
    const { dependencies, transport } = makeDependencies()
    const device = new Esp32TradeDevice(dependencies)
    await device.connect()

    await device.storeProdKeys(`
      aes_kek_generation_source = 00112233445566778899aabbccddeeff
      aes_key_generation_source = 00112233445566778899aabbccddeeff
      master_key_00 = 00112233445566778899aabbccddeeff
      master_key_12 = 00112233445566778899aabbccddeeff
    `)

    expect(transport.storeKeys).toHaveBeenCalledOnce()
    expect(transport.startBridge).toHaveBeenCalledOnce()
  })

  describe('runLink', () => {
    const adapter = {} as GbLinkRelayAdapter

    it('requires keys and a connection', async () => {
      const { dependencies, links } = makeDependencies({ keysComplete: false })
      const device = new Esp32TradeDevice(dependencies)
      const signal = new AbortController().signal
      await expect(
        device.runLink('wireless', adapter, { signal })
      ).rejects.toMatchObject({ code: 'not-connected' })
      await device.connect()
      await expect(
        device.runLink('wireless', adapter, { signal })
      ).rejects.toMatchObject({ code: 'missing-keys' })
      expect(links).toHaveLength(0)
      expect(device.state).toBe('connected')
    })

    it('stops the link and resolves when aborted', async () => {
      const { dependencies, links } = makeDependencies()
      const device = new Esp32TradeDevice(dependencies)
      await device.connect()
      const controller = new AbortController()
      const events: TradeDeviceEvent[] = []

      const running = device.runLink('wireless', adapter, {
        signal: controller.signal,
        onEvent: (event) => events.push(event),
      })
      await vi.waitFor(() => expect(links[0]?.start).toHaveBeenCalled())
      expect(links[0].kind).toBe('wireless')
      expect(links[0].adapter).toBe(adapter)
      await vi.waitFor(() => expect(device.state).toBe('trading'))
      await expect(
        device.runLink('cable', adapter, { signal: controller.signal })
      ).rejects.toMatchObject({ code: 'busy' })

      controller.abort()
      await running
      expect(links[0].stop).toHaveBeenCalledOnce()
      expect(device.state).toBe('connected')
      expect(events).toContainEqual({
        type: 'status',
        message: 'Relaying between the GBA and the Switch.',
      })
    })

    it('stops while the link is still starting', async () => {
      const { dependencies, links } = makeDependencies()
      let finishStart: (() => void) | undefined
      const createLink = dependencies.createLink
      dependencies.createLink = (...args) => {
        const link = createLink(...args)
        ;(link.start as ReturnType<typeof vi.fn>).mockImplementation(
          () =>
            new Promise<void>((resolve) => {
              finishStart = resolve
            })
        )
        return link
      }
      const device = new Esp32TradeDevice(dependencies)
      await device.connect()
      const controller = new AbortController()

      const running = device.runLink('wireless', adapter, {
        signal: controller.signal,
      })
      await vi.waitFor(() => expect(links[0]?.start).toHaveBeenCalled())
      controller.abort()
      await running

      expect(links[0].stop).toHaveBeenCalledOnce()
      expect(device.state).toBe('connected')
      finishStart?.()
    })

    it('reports cable link progress', async () => {
      const { dependencies, links } = makeDependencies()
      const device = new Esp32TradeDevice(dependencies)
      await device.connect()
      const controller = new AbortController()
      const messages: string[] = []

      const running = device.runLink('cable', adapter, {
        signal: controller.signal,
        onEvent: (event) => {
          if (event.type === 'status') messages.push(event.message)
        },
      })
      await vi.waitFor(() => expect(links[0]?.start).toHaveBeenCalled())
      await new Promise((resolve) => setTimeout(resolve, 0))
      const link = links[0] as unknown as Record<string, unknown>
      Object.assign(link, { cableOpen: true })
      links[0].dispatchEvent(new Event('change'))
      Object.assign(link, { linked: true })
      links[0].dispatchEvent(new Event('change'))
      Object.assign(link, { tradeReady: true })
      links[0].dispatchEvent(new Event('change'))
      controller.abort()
      await running
      expect(messages).toEqual([
        'GBA cable link open.',
        "Linked to the Switch's room.",
        'Ready to trade.',
      ])
    })

    it('rejects and stops when the link fails', async () => {
      const { dependencies, links } = makeDependencies()
      const device = new Esp32TradeDevice(dependencies)
      await device.connect()

      const running = device.runLink('wireless', adapter, {
        signal: new AbortController().signal,
      })
      await vi.waitFor(() => expect(links[0]?.start).toHaveBeenCalled())
      await new Promise((resolve) => setTimeout(resolve, 0))
      links[0].dispatchEvent(
        new CustomEvent('failed', { detail: new Error('port lost') })
      )
      await expect(running).rejects.toThrow('port lost')
      expect(links[0].stop).toHaveBeenCalledOnce()
      expect(device.state).toBe('connected')
    })
  })
})
