import { describe, expect, it, vi } from 'vitest'
import type { PokemonSaveAdapter } from './adapter'
import { PkhexRuntime } from './runtime'

const adapter = {} as PokemonSaveAdapter

describe('PkhexRuntime', () => {
  it('shares one pending initialization and publishes the adapter', async () => {
    let finish: ((value: PokemonSaveAdapter) => void) | undefined
    const create = vi.fn(
      () =>
        new Promise<PokemonSaveAdapter>((resolve) => {
          finish = resolve
        })
    )
    const runtime = new PkhexRuntime(create)
    const changed = vi.fn()
    runtime.subscribe(changed)

    const first = runtime.ensure()
    const second = runtime.ensure()
    expect(first).toBe(second)
    expect(create).toHaveBeenCalledOnce()
    finish!(adapter)
    await first

    expect(runtime.getSnapshot()).toEqual({
      adapter,
      loading: false,
      error: null,
    })
    expect(changed).toHaveBeenCalled()
    expect(await runtime.ensure()).toBe(adapter)
    expect(create).toHaveBeenCalledOnce()
  })

  it('publishes a failure and retries without creating parallel runtimes', async () => {
    const create = vi
      .fn<() => Promise<PokemonSaveAdapter>>()
      .mockRejectedValueOnce(new Error('boot failed'))
      .mockResolvedValueOnce(adapter)
    const runtime = new PkhexRuntime(create)

    await expect(runtime.ensure()).rejects.toThrow('boot failed')
    await Promise.resolve()
    expect(runtime.getSnapshot()).toMatchObject({
      adapter: null,
      loading: false,
      error: new Error('boot failed'),
    })

    await expect(runtime.retry()).resolves.toBe(adapter)
    expect(create).toHaveBeenCalledTimes(2)
    expect(runtime.getSnapshot().adapter).toBe(adapter)
  })
})
