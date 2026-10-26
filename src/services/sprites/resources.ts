import { i18n } from '../i18n'
import { SPRITE_SOURCES, DEFAULT_SPRITE_SOURCE_ID } from './catalog'
import type { SpriteManifestEntry, SpriteSourceDefinition } from './manifest'
import { initializeSpriteResolver, type SpriteResolver } from './resolver'

/** Bounded image loading; a new source replaces work that has not started. */
export class SpritePreloader {
  private queue: string[] = []
  private active = new Set<string>()
  private loaded = new Set<string>()

  private load: (path: string) => Promise<void>
  private concurrency: number

  constructor(load: (path: string) => Promise<void>, concurrency = 6) {
    this.load = load
    this.concurrency = concurrency
    if (!Number.isInteger(concurrency) || concurrency < 1)
      throw new Error(
        'Sprite concurrency must be a positive integer.'
      )
  }

  preload(paths: readonly string[]) {
    this.queue = [...new Set(paths)].filter(
      (path) => !this.loaded.has(path) && !this.active.has(path)
    )
    this.drain()
  }

  private drain() {
    while (this.active.size < this.concurrency && this.queue.length) {
      const path = this.queue.shift()!
      this.active.add(path)
      void Promise.resolve()
        .then(() => this.load(path))
        .then(
          () => {
            this.loaded.add(path)
          },
          () => {
            /* Missing or offline images must not block startup. */
          }
        )
        .finally(() => {
          this.active.delete(path)
          this.drain()
        })
    }
  }
}

/** The `<img src>` for an asset path; local paths live under the app base. */
export function spriteAssetUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${import.meta.env.BASE_URL}${path}`
}

const preloader = new SpritePreloader(
  (path) =>
    new Promise<void>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () =>
        reject(
          new Error(
            i18n.t('services:resources.couldNotLoadSprite', { path: path })
          )
        )
      image.src = spriteAssetUrl(path)
    })
)
const resolvers = new Map<string, SpriteResolver>()

export function spriteSource(id: string | null | undefined) {
  return SPRITE_SOURCES.find((source) => source.id === id) ?? null
}

/**
 * The source a page can actually show. A cross-origin-isolated page (the
 * Arcade) blocks hosts without CORP headers, so it falls back to the default.
 */
function displayableSource(id: string | null | undefined) {
  const fallback = spriteSource(DEFAULT_SPRITE_SOURCE_ID)!
  const source = spriteSource(id) ?? fallback
  return globalThis.crossOriginIsolated && !source.isolationSafe
    ? fallback
    : source
}

export function spriteResolver(id: string | null | undefined): SpriteResolver {
  const source = displayableSource(id)
  let resolver = resolvers.get(source.id)
  if (!resolver) {
    resolver = initializeSpriteResolver({
      sourceId: source.id,
      manifest: source.manifest,
      formAliases: source.formAliases,
    })
    resolvers.set(source.id, resolver)
  }
  return resolver
}

/** Every asset of a source, base forms first so common art is ready soonest. */
function preloadOrder(source: SpriteSourceDefinition): string[] {
  const isBase = (entry: SpriteManifestEntry) =>
    !entry.shiny && !entry.form && !entry.gender
  return [
    ...source.manifest.filter(isBase),
    ...source.manifest.filter((entry) => !isBase(entry)),
  ].map((entry) => entry.assetPath)
}

export interface SpriteSnapshot {
  /** The saved preference; null until settings load. */
  selectedId: string | null
  /** The source actually shown, after any isolation fallback. */
  sourceId: string
  resolver: SpriteResolver
}

/**
 * The selected sprite source. Each app root selects the saved preference at
 * startup and again when it changes; selecting starts preloading that
 * source's art so later screens find it cached.
 */
export class SpriteService {
  private snapshot: SpriteSnapshot
  private listeners = new Set<() => void>()
  private preloadedId: string | null = null
  private preload: (paths: readonly string[]) => void

  constructor(preload: (paths: readonly string[]) => void) {
    this.preload = preload
    const resolver = spriteResolver(null)
    this.snapshot = { selectedId: null, sourceId: resolver.sourceId, resolver }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = () => this.snapshot

  select(id: string | null | undefined) {
    const selectedId = spriteSource(id)?.id ?? null
    const source = displayableSource(selectedId)
    if (this.preloadedId !== source.id) {
      this.preloadedId = source.id
      this.preload(preloadOrder(source))
    }
    if (
      selectedId === this.snapshot.selectedId &&
      source.id === this.snapshot.sourceId
    )
      return
    this.snapshot = {
      selectedId,
      sourceId: source.id,
      resolver: spriteResolver(selectedId),
    }
    for (const listener of this.listeners) listener()
  }
}

export const sprites = new SpriteService((paths) => preloader.preload(paths))
