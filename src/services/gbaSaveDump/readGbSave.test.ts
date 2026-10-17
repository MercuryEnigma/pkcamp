import { describe, expect, it } from 'vitest'
import { receiveGbSave } from './readGbSave'

describe('GB/GBC save receiver', () => {
  it('rejects ROM/restore headers and retries bad SRAM sections', async () => {
    const queue = [
      new Uint8Array([0xf5]),
      new Uint8Array([3]),
      new Uint8Array([6]),
      new Uint8Array([0xf5 ^ 3 ^ 6]),
      new Uint8Array([0]),
      new Uint8Array([0xf5]),
      new Uint8Array([2]),
      new Uint8Array([6]),
      new Uint8Array([0xf5 ^ 2 ^ 6]),
      new Uint8Array([0]),
      new Uint8Array(256).fill(7),
      new Uint8Array([1]),
      new Uint8Array([0]),
      new Uint8Array(256).fill(8),
      new Uint8Array([0]),
      new Uint8Array([0]),
      new Uint8Array(256).fill(9),
      new Uint8Array([0]),
      new Uint8Array([0]),
    ]
    const sent: Uint8Array[] = []
    const bytes = await receiveGbSave(
      {
        exchangeBytes: async (tx) => {
          sent.push(tx)
          const next = queue.shift()
          if (!next) throw new Error('Unexpected exchange')
          return next
        },
      },
      { signal: new AbortController().signal }
    )
    expect(bytes).toEqual(
      new Uint8Array([
        ...new Uint8Array(256).fill(8),
        ...new Uint8Array(256).fill(9),
      ])
    )
    expect(sent[4][0]).toBe(0)
    expect(sent[9][0]).toBe(1)
    expect(sent[12][0]).toBe(0)
    expect(queue).toHaveLength(0)
  })

  it('honors cancellation before clocking', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      receiveGbSave(
        {
          exchangeBytes: async () => {
            throw new Error('Must not exchange')
          },
        },
        { signal: controller.signal }
      )
    ).rejects.toThrow()
  })
})
