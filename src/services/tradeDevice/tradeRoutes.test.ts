import { describe, expect, it, vi } from 'vitest'
import type { PokemonSaveAdapter } from '../pkhex'
import { TradeDeviceError, type TradeRequest } from './types.ts'
import {
  revertTrade,
  runTrade,
  tradeAvailability,
  tradeSideKey,
  type TradeDevices,
  type TradeSide,
} from './tradeRoutes.ts'

const bytes = (value: number) => new Uint8Array([value])

const save = (gameId: 'ruby' | 'sapphire', pk3?: number): TradeSide => ({
  device: 'save-backup',
  gameId,
  slot: pk3 === undefined ? undefined : { box: 0, index: 1, pk3: bytes(pk3) },
})
const camp = (pk3?: number): TradeSide => ({
  device: 'camp-site',
  slot: pk3 === undefined ? undefined : { site: 0, index: 2, pk3: bytes(pk3) },
})
const gba: TradeSide = { device: 'gb-link' }
const sw: TradeSide = { device: 'esp32' }

const adapter = {} as PokemonSaveAdapter

function makeDevices({
  companion = 100,
  gbLinkReceived,
}: { companion?: number | null; gbLinkReceived?: number } = {}) {
  const local = () => ({
    write: vi.fn(async () => {}),
    companion: vi.fn(async () =>
      companion === null ? null : bytes(companion)
    ),
  })
  const saveBackup = local()
  const campSite = local()
  const esp32 = {
    runLink: vi.fn(async () => {}),
    trade: vi.fn(async (_request: TradeRequest) => ({
      trades: [{ slot: 0, sent: bytes(1), received: bytes(9) }],
      party: [],
    })),
  }
  const lease = { adapter: {}, release: vi.fn(async () => {}) }
  const gbLink = {
    firmwareVersion: vi.fn(async (): Promise<string | null> => '2.2.7'),
    linkAdapter: vi.fn(async () => lease),
    trade: vi.fn(async (_request: TradeRequest) => ({
      trades:
        gbLinkReceived === undefined
          ? []
          : [{ slot: 0, sent: bytes(1), received: bytes(gbLinkReceived) }],
      party: [],
    })),
  }
  return {
    saveBackup,
    campSite,
    esp32,
    gbLink,
    lease,
    devices: { saveBackup, campSite, esp32, gbLink } as unknown as TradeDevices,
  }
}

function options(devices: TradeDevices) {
  return {
    adapter,
    devices,
    onCommitted: vi.fn(),
  }
}

describe('tradeAvailability', () => {
  it('blocks the same source, GBA↔GBA and Switch↔Switch', () => {
    expect(tradeAvailability(save('ruby'), save('ruby'))).toBe('blocked')
    expect(tradeAvailability(camp(), camp())).toBe('blocked')
    expect(tradeAvailability(gba, gba)).toBe('blocked')
    expect(tradeAvailability(sw, sw)).toBe('blocked')
  })

  it('allows GBA↔Switch', () => {
    expect(tradeAvailability(gba, sw)).toBe('ok')
    expect(tradeAvailability(sw, gba)).toBe('ok')
  })

  it('allows local↔local and local↔hardware', () => {
    const locals = [save('ruby'), save('sapphire'), camp()]
    for (const local of locals) {
      for (const other of [...locals, gba, sw]) {
        if (tradeSideKey(local) === tradeSideKey(other)) continue
        expect(tradeAvailability(local, other)).toBe('ok')
        expect(tradeAvailability(other, local)).toBe('ok')
      }
    }
  })
})

describe('runTrade', () => {
  it('swaps two local slots and persists both', async () => {
    const { devices, saveBackup, campSite } = makeDevices()
    await runTrade(
      save('ruby', 1),
      camp(2),
      new AbortController().signal,
      options(devices)
    )
    expect(saveBackup.write).toHaveBeenCalledWith(
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(1),
      bytes(2)
    )
    expect(campSite.write).toHaveBeenCalledWith(
      adapter,
      { site: 0, index: 2 },
      bytes(2),
      bytes(1)
    )
  })

  it('restores the first slot when the second write fails', async () => {
    const { devices, saveBackup } = makeDevices()
    saveBackup.write
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('slot changed'))
    await expect(
      runTrade(
        save('ruby', 1),
        save('sapphire', 2),
        new AbortController().signal,
        options(devices)
      )
    ).rejects.toThrow('slot changed')
    expect(saveBackup.write).toHaveBeenLastCalledWith(
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(2),
      bytes(1)
    )
  })

  it('trades with the Switch using a silent companion', async () => {
    const { devices, esp32, campSite } = makeDevices()
    await runTrade(camp(1), sw, new AbortController().signal, options(devices))
    expect(esp32.trade).toHaveBeenCalledWith(
      expect.objectContaining({
        party: [bytes(1), bytes(100), null, null, null, null],
        selectedSlot: 0,
      })
    )
    expect(campSite.write).toHaveBeenCalledWith(
      adapter,
      { site: 0, index: 2 },
      bytes(1),
      bytes(9)
    )
  })

  it('serializes multiple receipts in one room without writing the final result twice', async () => {
    const { devices, esp32, saveBackup } = makeDevices()
    esp32.trade.mockImplementationOnce(async (request) => {
      request.onEvent!({ type: 'trade-completed', slot: 0, received: bytes(8) })
      request.onEvent!({ type: 'trade-completed', slot: 0, received: bytes(9) })
      return {
        trades: [{ slot: 0, sent: bytes(8), received: bytes(9) }],
        party: [],
      }
    })
    const writes = await runTrade(
      save('ruby', 1),
      sw,
      new AbortController().signal,
      options(devices)
    )
    expect(saveBackup.write).toHaveBeenCalledTimes(2)
    expect(saveBackup.write).toHaveBeenNthCalledWith(
      1,
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(1),
      bytes(8)
    )
    expect(saveBackup.write).toHaveBeenNthCalledWith(
      2,
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(8),
      bytes(9)
    )
    expect(writes).toEqual([
      { side: save('ruby', 1), before: bytes(1), after: bytes(9) },
    ])
  })

  it('leaves the save unchanged when the Switch room closes before receipt', async () => {
    const { devices, esp32, saveBackup } = makeDevices()
    esp32.trade.mockResolvedValueOnce({ trades: [], party: [] })
    await expect(
      runTrade(
        save('ruby', 1),
        sw,
        new AbortController().signal,
        options(devices)
      )
    ).rejects.toThrow('without completing a trade')
    expect(saveBackup.write).not.toHaveBeenCalled()
  })

  it('requires a companion for the Switch', async () => {
    const { devices, esp32 } = makeDevices({ companion: null })
    await expect(
      runTrade(camp(1), sw, new AbortController().signal, options(devices))
    ).rejects.toThrow('Two Pokémon')
    expect(esp32.trade).not.toHaveBeenCalled()
  })

  it('leaves the save unchanged when GB-Link cannot return the received Pokémon', async () => {
    const { devices, saveBackup } = makeDevices()
    await expect(
      runTrade(
        gba,
        save('ruby', 1),
        new AbortController().signal,
        options(devices)
      )
    ).rejects.toThrow('without completing a trade')
    expect(saveBackup.write).not.toHaveBeenCalled()
  })

  it('persists a received Pokémon before the room closes and keeps it on cancellation', async () => {
    const { devices, esp32, saveBackup } = makeDevices()
    const controller = new AbortController()
    const opts = options(devices)
    let request!: TradeRequest
    esp32.trade.mockImplementationOnce(async (value) => {
      request = value
      return new Promise((_resolve, reject) => {
        value.signal!.addEventListener('abort', () =>
          reject(value.signal!.reason)
        )
      })
    })
    const running = runTrade(save('ruby', 1), sw, controller.signal, opts)
    await vi.waitFor(() => expect(request).toBeDefined())
    request.onEvent!({ type: 'trade-completed', slot: 0, received: bytes(9) })
    await vi.waitFor(() => expect(opts.onCommitted).toHaveBeenCalledOnce())
    expect(saveBackup.write).toHaveBeenCalledWith(
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(1),
      bytes(9)
    )
    controller.abort()
    expect(await running).toEqual([
      { side: save('ruby', 1), before: bytes(1), after: bytes(9) },
    ])
    expect(saveBackup.write).toHaveBeenCalledOnce()
  })

  it('waits for a received Pokémon to finish saving after cancellation', async () => {
    const { devices, esp32, saveBackup } = makeDevices()
    const controller = new AbortController()
    let finishSave!: () => void
    saveBackup.write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        })
    )
    esp32.trade.mockImplementationOnce(async (request) => {
      request.onEvent!({ type: 'trade-completed', slot: 0, received: bytes(9) })
      controller.abort()
      throw controller.signal.reason
    })
    let settled = false
    const running = runTrade(
      save('ruby', 1),
      sw,
      controller.signal,
      options(devices)
    ).then((writes) => {
      settled = true
      return writes
    })
    await vi.waitFor(() => expect(finishSave).toBeDefined())
    expect(settled).toBe(false)
    finishSave()
    expect(await running).toHaveLength(1)
  })

  it('ignores received data arriving after cancellation', async () => {
    const { devices, esp32, saveBackup } = makeDevices()
    const controller = new AbortController()
    esp32.trade.mockImplementationOnce(async (request) => {
      controller.abort()
      request.onEvent!({ type: 'trade-completed', slot: 0, received: bytes(9) })
      return {
        trades: [{ slot: 0, sent: bytes(1), received: bytes(9) }],
        party: [],
      }
    })
    await expect(
      runTrade(save('ruby', 1), sw, controller.signal, options(devices))
    ).rejects.toThrow()
    expect(saveBackup.write).not.toHaveBeenCalled()
  })

  it('reports persistence failure even when the room is cancelled', async () => {
    const { devices, esp32, saveBackup } = makeDevices()
    const controller = new AbortController()
    saveBackup.write.mockRejectedValueOnce(new Error('save failed'))
    esp32.trade.mockImplementationOnce(async (request) => {
      request.onEvent!({ type: 'trade-completed', slot: 0, received: bytes(9) })
      controller.abort()
      throw controller.signal.reason
    })
    await expect(
      runTrade(save('ruby', 1), sw, controller.signal, options(devices))
    ).rejects.toThrow('save failed')
  })

  it('prefers a PK3 returned by the GB-Link', async () => {
    const { devices, saveBackup } = makeDevices({ gbLinkReceived: 8 })
    const opts = options(devices)
    await runTrade(save('ruby', 1), gba, new AbortController().signal, opts)
    expect(saveBackup.write).toHaveBeenCalledWith(
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(1),
      bytes(8)
    )
  })

  it('writes nothing when the GB-Link trade is aborted', async () => {
    const { devices, gbLink, saveBackup } = makeDevices()
    const controller = new AbortController()
    gbLink.trade.mockImplementationOnce(async () => {
      controller.abort()
      throw controller.signal.reason
    })
    await expect(
      runTrade(save('ruby', 1), gba, controller.signal, options(devices))
    ).rejects.toThrow()
    expect(saveBackup.write).not.toHaveBeenCalled()
  })

  describe('GBA ↔ Switch', () => {
    const wirelessGba: TradeSide = { device: 'gb-link', gbaGame: 'wireless' }
    const cableGba: TradeSide = { device: 'gb-link', gbaGame: 'cable' }

    it('requires the GBA game to be chosen', async () => {
      const { devices, gbLink } = makeDevices()
      await expect(
        runTrade(gba, sw, new AbortController().signal, options(devices))
      ).rejects.toThrow('Choose the game on the GBA.')
      expect(gbLink.linkAdapter).not.toHaveBeenCalled()
    })

    it.each(['2.2.6', '2.1.0', null])(
      'rejects firmware %s without taking the adapter',
      async (version) => {
        const { devices, gbLink, esp32 } = makeDevices()
        gbLink.firmwareVersion.mockResolvedValue(version)
        const error = await runTrade(
          wirelessGba,
          sw,
          new AbortController().signal,
          options(devices)
        ).catch((cause: unknown) => cause)
        expect(error).toBeInstanceOf(TradeDeviceError)
        expect((error as TradeDeviceError).code).toBe('unsupported')
        expect(gbLink.linkAdapter).not.toHaveBeenCalled()
        expect(esp32.runLink).not.toHaveBeenCalled()
      }
    )

    it('relays with the chosen kind, writes nothing and releases', async () => {
      const { devices, esp32, gbLink, lease, saveBackup, campSite } =
        makeDevices()
      const controller = new AbortController()
      const opts = options(devices)
      const writes = await runTrade(sw, cableGba, controller.signal, opts)
      expect(writes).toEqual([])
      expect(esp32.runLink).toHaveBeenCalledWith('cable', lease.adapter, {
        signal: controller.signal,
        onEvent: undefined,
      })
      expect(gbLink.linkAdapter).toHaveBeenCalledWith(controller.signal)
      expect(lease.release).toHaveBeenCalledOnce()
      expect(saveBackup.write).not.toHaveBeenCalled()
      expect(campSite.write).not.toHaveBeenCalled()
      expect(gbLink.trade).not.toHaveBeenCalled()
      expect(esp32.trade).not.toHaveBeenCalled()
    })

    it('releases the adapter when the link fails', async () => {
      const { devices, esp32, lease } = makeDevices()
      esp32.runLink.mockRejectedValueOnce(new Error('link failed'))
      await expect(
        runTrade(
          wirelessGba,
          sw,
          new AbortController().signal,
          options(devices)
        )
      ).rejects.toThrow('link failed')
      expect(esp32.runLink).toHaveBeenCalledWith(
        'wireless',
        lease.adapter,
        expect.anything()
      )
      expect(lease.release).toHaveBeenCalledOnce()
    })

    it('releases the adapter when the link ends on abort', async () => {
      const { devices, esp32, lease } = makeDevices()
      const controller = new AbortController()
      esp32.runLink.mockImplementationOnce(async () => {
        controller.abort()
      })
      await runTrade(wirelessGba, sw, controller.signal, options(devices))
      expect(lease.release).toHaveBeenCalledOnce()
    })
  })

  it('requires a selected Pokémon on local sides', async () => {
    const { devices } = makeDevices()
    await expect(
      runTrade(save('ruby'), sw, new AbortController().signal, options(devices))
    ).rejects.toThrow('Select one Pokémon')
  })
})

describe('revertTrade', () => {
  it('restores both slots of a local swap in reverse order', async () => {
    const { devices, saveBackup, campSite } = makeDevices()
    const writes = await runTrade(
      save('ruby', 1),
      camp(2),
      new AbortController().signal,
      options(devices)
    )
    saveBackup.write.mockClear()
    campSite.write.mockClear()

    await revertTrade(writes, { adapter, devices })

    expect(campSite.write).toHaveBeenCalledWith(
      adapter,
      { site: 0, index: 2 },
      bytes(1),
      bytes(2)
    )
    expect(saveBackup.write).toHaveBeenCalledWith(
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(2),
      bytes(1)
    )
    expect(campSite.write.mock.invocationCallOrder[0]).toBeLessThan(
      saveBackup.write.mock.invocationCallOrder[0]
    )
  })

  it('puts back the Pokémon replaced by a received GB-Link Pokémon', async () => {
    const { devices, saveBackup } = makeDevices({ gbLinkReceived: 8 })
    const writes = await runTrade(
      save('ruby', 1),
      gba,
      new AbortController().signal,
      options(devices)
    )
    expect(writes).toHaveLength(1)

    await revertTrade(writes, { adapter, devices })

    expect(saveBackup.write).toHaveBeenLastCalledWith(
      adapter,
      { gameId: 'ruby', box: 0, index: 1 },
      bytes(8),
      bytes(1)
    )
  })
})
