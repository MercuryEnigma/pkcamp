import { describe, expect, it, vi } from 'vitest'
import {
  GB_LINK_COMMAND,
  GB_LINK_MODE,
  GB_LINK_STATUS,
} from './gbLinkProtocol.ts'
import {
  GbLinkTradeDevice,
  type GbLinkTradeDeviceDependencies,
} from './gbLinkTradeDevice.ts'
import type { GbLinkTransport } from './gbLinkTransport.ts'
import type { TradeDeviceEvent } from './types.ts'

class FakeGbLinkTransport implements GbLinkTransport {
  attached = false
  readonly kind = 'webserial' as const
  readonly commands: { command: number; args: Uint8Array }[] = []
  readonly data: Uint8Array[] = []
  private readonly statusListeners = new Set<(status: number) => void>()
  finishAfterUploads = true

  async open(): Promise<void> {
    this.attached = true
  }

  async close(): Promise<void> {
    this.attached = false
  }

  async sendCommand(command: number, args = new Uint8Array()): Promise<void> {
    this.commands.push({ command, args: args.slice() })
    if (command === GB_LINK_COMMAND.setMode) {
      this.emitStatus(GB_LINK_STATUS.deviceReady)
    }
  }

  async sendData(payload: Uint8Array): Promise<void> {
    this.data.push(payload.slice())
    if (this.finishAfterUploads && this.data.length === 12) {
      this.emitStatus(GB_LINK_STATUS.emulationSessionStarted)
      this.emitStatus(GB_LINK_STATUS.tradeSessionFinished)
    }
  }

  onStatus(listener: (status: number) => void): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  onData(): () => void {
    return () => {}
  }

  emitStatus(status: number): void {
    for (const listener of this.statusListeners) listener(status)
  }
}

function makeDevice(transport = new FakeGbLinkTransport()): {
  device: GbLinkTradeDevice
  transport: FakeGbLinkTransport
  encodePokemon: ReturnType<typeof vi.fn>
} {
  const encodePokemon = vi.fn((pk3: Uint8Array) => {
    const encoded = new Uint8Array(100)
    encoded.fill(pk3[0])
    return encoded
  })
  const dependencies: GbLinkTradeDeviceDependencies = {
    isSupported: () => true,
    createTransport: () => transport,
    encodePokemon,
    readyTimeoutMs: 100,
    sessionTimeoutMs: 100,
  }
  return {
    device: new GbLinkTradeDevice(dependencies),
    transport,
    encodePokemon,
  }
}

function request(onEvent?: (event: TradeDeviceEvent) => void) {
  return {
    party: [
      new Uint8Array([1]),
      new Uint8Array([2]),
      null,
      null,
      null,
      null,
    ],
    selectedSlot: 1,
    onEvent,
  }
}

describe('GbLinkTradeDevice', () => {
  it('connects, initializes trade-emulation mode, and uploads six copies of the selected Pokémon', async () => {
    const { device, transport, encodePokemon } = makeDevice()
    const events: TradeDeviceEvent[] = []

    expect(device.state).toBe('disconnected')
    await device.connect()
    expect(device.state).toBe('connected')

    const result = await device.trade(request((event) => events.push(event)))

    expect(transport.commands.slice(0, 2)).toEqual([
      { command: GB_LINK_COMMAND.cancel, args: new Uint8Array() },
      {
        command: GB_LINK_COMMAND.setMode,
        args: new Uint8Array([GB_LINK_MODE.tradeEmulation]),
      },
    ])
    expect(encodePokemon).toHaveBeenCalledTimes(1)
    expect(transport.data).toHaveLength(12)
    expect(transport.data.every((chunk) => chunk.length === 50)).toBe(true)
    expect(transport.data.map((chunk) => chunk[0])).toEqual(Array(12).fill(2))
    expect(events).toContainEqual({ type: 'trade-started' })
    expect(events).toContainEqual({ type: 'trade-started' })
    expect(events.at(-1)).toEqual({
      type: 'hardware-trade-finished',
      receivedAvailable: false,
    })
    expect(result.trades).toEqual([])
    expect(result.party).toEqual(request().party)
    expect(device.state).toBe('connected')

    await device.disconnect()
    expect(transport.attached).toBe(false)
    expect(device.state).toBe('disconnected')
  })

  it('cancels the firmware session when the request is aborted', async () => {
    const transport = new FakeGbLinkTransport()
    transport.finishAfterUploads = false
    const { device } = makeDevice(transport)
    const controller = new AbortController()
    await device.connect()

    const trade = device.trade({ ...request(), signal: controller.signal })
    await vi.waitFor(() => expect(transport.data).toHaveLength(12))
    controller.abort(new DOMException('Cancelled by test.', 'AbortError'))

    await expect(trade).rejects.toMatchObject({ name: 'AbortError' })
    expect(transport.commands.map(({ command }) => command)).toEqual([
      GB_LINK_COMMAND.cancel,
      GB_LINK_COMMAND.setMode,
      GB_LINK_COMMAND.cancel,
    ])
    expect(device.state).toBe('connected')
  })

  it('works with only the selected Pokémon in the party', async () => {
    const { device, transport } = makeDevice()
    await device.connect()

    const result = await device.trade({
      party: [null, null, new Uint8Array([5]), null, null, null],
      selectedSlot: 2,
    })

    expect(transport.data).toHaveLength(12)
    expect(transport.data.every((chunk) => chunk[0] === 5)).toBe(true)
    expect(result.trades).toEqual([])
    expect(result.party[2]).toEqual(new Uint8Array([5]))
  })
})
