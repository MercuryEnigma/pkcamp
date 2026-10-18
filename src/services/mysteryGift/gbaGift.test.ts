import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  GB_LINK_COMMAND,
  GB_LINK_MODE,
  GB_LINK_STATUS,
} from '../tradeDevice/gbLinkProtocol'

const device = vi.hoisted(() => ({
  firmware: '2.2.7' as string | null,
  commands: [] as number[][],
  sent: [] as Uint8Array[],
  statusListeners: new Set<(status: number) => void>(),
  freed: 0,
  disconnects: 0,
}))

vi.mock('../tradeDevice', () => ({
  gbLinkTradeDevice: {
    connect: async () => {},
    disconnect: async () => {
      device.disconnects++
    },
    firmwareVersion: async () => device.firmware,
    claim: () => ({
      signal: new AbortController().signal,
      free: () => {
        device.freed++
      },
      transport: {
        attached: true,
        async sendCommand(command: number, args = new Uint8Array(0)) {
          device.commands.push([command, ...args])
          if (command === GB_LINK_COMMAND.setMode) {
            queueMicrotask(() =>
              device.statusListeners.forEach((listener) =>
                listener(GB_LINK_STATUS.awaitMode)
              )
            )
          }
        },
        async sendData(payload: Uint8Array) {
          expect(payload.length).toBeLessThanOrEqual(64)
          device.sent.push(payload)
        },
        onData: () => () => {},
        onStatus(listener: (status: number) => void) {
          device.statusListeners.add(listener)
          return () => device.statusListeners.delete(listener)
        },
      },
    }),
  },
}))

const { openGbaGift } = await import('./gbaGift')

const handlers = {
  onStatus: vi.fn(),
  onDecision: vi.fn(),
  onResult: vi.fn(),
  onFailed: vi.fn(),
}

beforeEach(() => {
  device.firmware = '2.2.7'
  device.commands = []
  device.sent = []
  device.statusListeners.clear()
  device.freed = 0
  device.disconnects = 0
  vi.clearAllMocks()
})

describe('openGbaGift', () => {
  it('cancels startup before entering Wireless Adapter mode and frees the board', async () => {
    const controller = new AbortController()
    const opening = openGbaGift('custom-speed-4', handlers, {
      signal: controller.signal,
    })
    const rejected = expect(opening).rejects.toMatchObject({
      name: 'AbortError',
    })
    await vi.waitFor(() => expect(device.commands).toHaveLength(1))
    controller.abort()
    await rejected
    expect(
      device.commands.every(([command]) => command === GB_LINK_COMMAND.cancel)
    ).toBe(true)
    expect(device.freed).toBe(1)
    expect(device.statusListeners.size).toBe(0)
    expect(handlers.onStatus).not.toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'open' })
    )
  })

  it('waits for the same cleanup on repeated stop and suppresses later status', async () => {
    const link = await openGbaGift('custom-speed-4', handlers)
    handlers.onStatus.mockClear()
    const first = link.stop()
    expect(link.stop()).toBe(first)
    link.setGift('goppier-altering-cave')
    link.decide(true)
    await first
    expect(device.freed).toBe(1)
    expect(device.statusListeners.size).toBe(0)
    expect(handlers.onStatus).not.toHaveBeenCalled()
  })

  it('refuses GB-Link firmware without Wireless Adapter mode', async () => {
    device.firmware = '2.2.5'
    await expect(openGbaGift('custom-speed-4', handlers)).rejects.toThrow(
      'firmware 2.2.7 or newer; this GB-Link has 2.2.5'
    )
    expect(device.commands).toEqual([])
  })

  it('opens the group in Wireless Adapter mode and closes it again', async () => {
    const link = await openGbaGift('custom-speed-4', handlers)
    expect(device.commands).toEqual([
      [GB_LINK_COMMAND.cancel],
      [GB_LINK_COMMAND.setVoltage3V3],
      [GB_LINK_COMMAND.setMode, GB_LINK_MODE.rfuWireless, 0],
    ])
    expect(handlers.onStatus).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'open' })
    )
    link.setGift('goppier-altering-cave')
    await link.stop()
    expect(device.commands.at(-1)).toEqual([GB_LINK_COMMAND.cancel])
    expect(device.freed).toBe(1)
    expect(device.disconnects).toBe(1)
    await link.stop()
    expect(device.freed).toBe(1)
    expect(device.disconnects).toBe(1)
  })

  it('rejects an unknown gift before touching the GB-Link', async () => {
    await expect(openGbaGift('no-such-gift', handlers)).rejects.toThrow(
      'Unknown Mystery Gift'
    )
    expect(device.commands).toEqual([])
  })
})
