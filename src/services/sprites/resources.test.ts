import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SPRITE_SOURCE_ID } from './catalog'
import {
  SpritePreloader,
  SpriteService,
  spriteResolver,
  spriteSource,
} from './resources'

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
  it('notifies when a different source is selected and ignores repeats', () => {
    const service = new SpriteService(() => {})
    const listener = vi.fn()
    service.subscribe(listener)
    service.select('shuffle')
    service.select('shuffle')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(service.getSnapshot()).toMatchObject({
      selectedId: 'shuffle',
      sourceId: 'shuffle',
    })
    expect(service.getSnapshot().resolver).toBe(spriteResolver('shuffle'))
  })
})

describe('sprite service preloading', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })
  it('preloads every asset of the selected source, base forms first, once per source', () => {
    const preload = vi.fn()
    const service = new SpriteService(preload)
    service.select('shuffle')
    service.select('shuffle')
    expect(preload).toHaveBeenCalledTimes(1)
    const source = spriteSource('shuffle')!
    const paths: string[] = preload.mock.calls[0][0]
    expect(paths).toHaveLength(source.manifest.length)
    const bases = source.manifest.filter(
      (entry) => !entry.shiny && !entry.form && !entry.gender
    ).length
    const firstVariant = source.manifest.find(
      (entry) => entry.shiny || entry.form || entry.gender
    )!
    expect(paths.indexOf(firstVariant.assetPath)).toBeGreaterThanOrEqual(bases)
  })
  it('preloads the default source before a preference is saved', () => {
    const preload = vi.fn()
    new SpriteService(preload).select(null)
    expect(preload.mock.calls[0][0]).toHaveLength(
      spriteSource(DEFAULT_SPRITE_SOURCE_ID)!.manifest.length
    )
  })
  it('falls back to the default source where isolation blocks the host', () => {
    vi.stubGlobal('crossOriginIsolated', true)
    const preload = vi.fn()
    const service = new SpriteService(preload)
    service.select('pokemondb')
    expect(service.getSnapshot()).toMatchObject({
      selectedId: 'pokemondb',
      sourceId: DEFAULT_SPRITE_SOURCE_ID,
    })
    expect(preload.mock.calls[0][0][0]).toMatch(
      /^https:\/\/raw\.githubusercontent\.com\//
    )
    service.select('pmdcollab')
    expect(service.getSnapshot().sourceId).toBe('pmdcollab')
  })
})
