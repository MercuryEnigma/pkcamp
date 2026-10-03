import { describe, expect, it, vi } from 'vitest'
import {
  createTradeDeviceService,
  Esp32TradeDevice,
  TradeDeviceError,
  type Esp32TradeDeviceDependencies,
  type Esp32TradeSession,
  type Esp32Transport,
  type TradeDeviceEvent,
} from './index.ts'
import { GbLinkTradeDevice as ImplementedGbLinkTradeDevice } from './gbLinkTradeDevice.ts'

function pokemon(value: number): Uint8Array {
  return new Uint8Array([value])
}

function makeDependencies(options?: { keysComplete?: boolean }): {
  dependencies: Esp32TradeDeviceDependencies
  transport: Esp32Transport
  sessions: Esp32TradeSession[]
} {
  const sessions: Esp32TradeSession[] = []
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

  return { dependencies, transport, sessions }
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
})
