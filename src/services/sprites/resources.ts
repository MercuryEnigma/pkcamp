import { i18n } from '../i18n'
import { SPRITE_SOURCES, DEFAULT_SPRITE_SOURCE_ID } from './catalog'
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
        i18n.t('services:resources.spriteConcurrencyMustBeAPositiveInteger')
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
      image.src = path
    })
)
let selectedSource: string | null | undefined
const resolvers = new Map<string, SpriteResolver>()

export function spriteSource(id: string | null | undefined) {
  return SPRITE_SOURCES.find((source) => source.id === id) ?? null
}

export function spriteResolver(id: string | null | undefined): SpriteResolver {
  const source = spriteSource(id) ?? spriteSource(DEFAULT_SPRITE_SOURCE_ID)!
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

/** Called by startup and when the saved appearance preference changes. */
export function preloadSpriteSource(id: string | null) {
  if (selectedSource === id) return
  selectedSource = id
  const source = spriteSource(id)
  preloader.preload(
    source?.manifest
      .filter((entry) => !entry.shiny && !entry.form && !entry.gender)
      .map((entry) => entry.assetPath) ?? []
  )
}
