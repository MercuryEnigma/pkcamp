import { describe, expect, it, vi } from 'vitest'
import { SpritePreloader, spriteResolver, spriteSource } from './resources'

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}

describe('sprite resources', () => {
  it('limits requests, deduplicates paths, and replaces queued work on a source change', async () => {
    const done = new Map<string, () => void>()
    const load = vi.fn(
      (path: string) =>
        new Promise<void>((resolve) => {
          done.set(path, resolve)
        })
    )
    const preloader = new SpritePreloader(load, 2)
    preloader.preload(['a', 'a', 'b', 'old'])
    await flush()
    expect(load.mock.calls.map(([path]) => path)).toEqual(['a', 'b'])
    preloader.preload(['a', 'c', 'd'])
    done.get('a')!()
    await flush()
    expect(load.mock.calls.map(([path]) => path)).toEqual(['a', 'b', 'c'])
    done.get('b')!()
    await flush()
    expect(load.mock.calls.map(([path]) => path)).toEqual(['a', 'b', 'c', 'd'])
    done.get('c')!()
    done.get('d')!()
    await flush()
    preloader.preload(['a', 'c'])
    await flush()
    expect(load).toHaveBeenCalledTimes(4)
  })
  it('continues loading after an image fails', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    new SpritePreloader(load, 1).preload(['missing', 'next'])
    await flush()
    expect(load.mock.calls.map(([path]) => path)).toEqual(['missing', 'next'])
  })
  it('reuses resolvers and handles missing settings', () => {
    expect(spriteSource('unknown')).toBeNull()
    expect(spriteResolver(null)).toBe(spriteResolver('unknown'))
  })
})
