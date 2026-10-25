import { i18n } from '../i18n'
import type { GbaButton } from './input'

export interface MgbaModule {
  FS: {
    analyzePath(path: string): { exists: boolean }
    mkdir(path: string): void
    unlink(path: string): void
    writeFile(path: string, bytes: Uint8Array): void
  }
  addCoreCallbacks(callbacks: {
    saveDataUpdatedCallback?(): void
    coreCrashedCallback?(): void
  }): void
  buttonPress(button: string): void
  buttonUnpress(button: string): void
  getSave(): Uint8Array | null
  loadGame(romPath: string, savePath?: string): boolean
  pauseGame(): void
  quickReload(): void
  quitGame(): void
  resumeGame(): void
  setCoreSettings(settings: Record<string, boolean | number>): void
  setFastForwardMultiplier(multiplier: number): void
  setVolume(volume: number): void
  toggleInput(enabled: boolean): void
}

export type MgbaFactory = (options: {
  canvas: HTMLCanvasElement
}) => Promise<MgbaModule>

const RUNTIME_URL = `${import.meta.env.BASE_URL}arcade/mgba/mgba.js`

const DIRECTORIES = [
  '/data',
  '/data/games',
  '/data/saves',
  '/data/states',
  '/data/cheats',
  '/data/screenshots',
  '/data/patches',
  '/autosave',
]
const ROM_PATH = '/data/games/arcade.gba'
const SAVE_PATH = '/data/saves/arcade.sav'

export interface MgbaSessionOptions {
  canvas: HTMLCanvasElement
  rom: Uint8Array
  save?: Uint8Array
  onSaveChanged(): void
  onCrash(): void
  /** Cancel a queued or still-initializing start before a core is loaded. */
  signal?: AbortSignal
}

export interface MgbaSession {
  pause(): void
  resume(): void
  /** Restarts the game from its battery save, like power-cycling the GBA. */
  reset(): void
  setButton(button: GbaButton, pressed: boolean): void
  /**
   * Speed multiplier; 1 is normal speed. Above 1 rounds to a whole number;
   * below 1 slows to 1/N for a whole N (0.5 is half speed).
   */
  setSpeed(multiplier: number): void
  /** Volume from 0 (silent) to 1 (normal). */
  setVolume(volume: number): void
  /** A copy of the battery save as mGBA last synced it, or null once stopped. */
  getSave(): Uint8Array | null
  /** Idempotent; a stale session's stop never quits a newer session. */
  stop(): void
}

export interface MgbaRuntime {
  /** Starts a game, replacing any running one, on the document's one module. */
  start(options: MgbaSessionOptions): Promise<MgbaSession>
}

interface ActiveSession {
  options: MgbaSessionOptions
  stopped: boolean
}

/**
 * mGBA's fast-forward multiplier for a speed: N above 1 is N times as fast,
 * and a negative -N is 1/N speed. Non-positive input is normal speed.
 */
export function mgbaSpeed(multiplier: number): number {
  if (!(multiplier > 0) || Math.abs(multiplier - 1) < 0.01) return 1
  if (multiplier > 1) return Math.round(multiplier)
  return -Math.max(2, Math.round(1 / multiplier))
}

/**
 * Owns the single mGBA module of a player document. The module allocates a
 * fixed 256 MiB shared heap and a pthread pool and cannot be released short of
 * leaving the page, so every session reuses it, bound to the first canvas.
 */
export function createMgbaRuntime(
  loadFactory: () => Promise<MgbaFactory>
): MgbaRuntime {
  let modulePromise: Promise<MgbaModule> | null = null
  let moduleCanvas: HTMLCanvasElement | null = null
  let active: ActiveSession | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const getModule = (canvas: HTMLCanvasElement): Promise<MgbaModule> => {
    if (moduleCanvas && moduleCanvas !== canvas) {
      return Promise.reject(
        new Error(
          i18n.t(
            'services:mgbaRuntime.mgbaIsAlreadyBoundToAnotherScreenReloadThePlayer'
          )
        )
      )
    }
    if (!modulePromise) {
      moduleCanvas = canvas
      modulePromise = loadFactory()
        .then((factory) => factory({ canvas }))
        .then((module) => {
          for (const path of DIRECTORIES) {
            if (!module.FS.analyzePath(path).exists) module.FS.mkdir(path)
          }
          return module
        })
      // A failed download or instantiation may be retried by the next start.
      modulePromise.catch(() => {
        modulePromise = null
        moduleCanvas = null
      })
    }
    return modulePromise
  }

  const startNow = async (
    options: MgbaSessionOptions
  ): Promise<MgbaSession> => {
    options.signal?.throwIfAborted()
    const module = await getModule(options.canvas)
    options.signal?.throwIfAborted()
    if (active) {
      active.stopped = true
      active = null
      module.quitGame()
    }

    module.FS.writeFile(ROM_PATH, options.rom)
    if (options.save) module.FS.writeFile(SAVE_PATH, options.save)
    else if (module.FS.analyzePath(SAVE_PATH).exists) {
      // Never let a previous session's save become this new game's save.
      module.FS.unlink(SAVE_PATH)
    }
    module.setCoreSettings({
      autoSaveStateEnable: false,
      restoreAutoSaveStateOnLoad: false,
      rewindEnable: false,
    })

    const session: ActiveSession = { options, stopped: false }
    active = session
    if (!module.loadGame(ROM_PATH, SAVE_PATH)) {
      session.stopped = true
      active = null
      module.quitGame()
      throw new Error(i18n.t('services:mgbaRuntime.mgbaCouldNotLoadThisRom'))
    }
    // Each loadGame creates a new core, and mGBA ignores callbacks registered
    // without one, so they are attached after every load. The JS wrapper
    // frees the previous function-table entries. Bind these handlers to this
    // session so even a retained callback from an old core cannot target the
    // replacement session. Dispatch later because the core thread waits while
    // its callback runs on the main thread.
    const dispatch = (handler: 'onSaveChanged' | 'onCrash') => () => {
      setTimeout(() => {
        if (active === session && !session.stopped) session.options[handler]()
      })
    }
    module.addCoreCallbacks({
      saveDataUpdatedCallback: dispatch('onSaveChanged'),
      coreCrashedCallback: dispatch('onCrash'),
    })
    // loadGame installs mGBA's own keyboard bindings; pkCamp owns input.
    module.toggleInput(false)

    const live = () => !session.stopped
    return {
      pause: () => live() && module.pauseGame(),
      resume: () => live() && module.resumeGame(),
      // Auto save states are off, so this does not restore one.
      reset: () => live() && module.quickReload(),
      setButton: (button, pressed) => {
        if (!live()) return
        if (pressed) module.buttonPress(button)
        else module.buttonUnpress(button)
      },
      setSpeed: (multiplier) =>
        live() && module.setFastForwardMultiplier(mgbaSpeed(multiplier)),
      setVolume: (volume) =>
        live() && module.setVolume(Math.min(1, Math.max(0, volume))),
      getSave: () => (live() ? (module.getSave()?.slice() ?? null) : null),
      stop: () => {
        if (session.stopped) return
        session.stopped = true
        if (active === session) {
          active = null
          module.quitGame()
        }
      },
    }
  }

  return {
    start(options) {
      // Serialize starts so overlapping clicks cannot race the module.
      const run = queue.then(() => startNow(options))
      queue = run.catch(() => {})
      return run
    },
  }
}

const runtime = createMgbaRuntime(async () => {
  const loaded = (await import(/* @vite-ignore */ RUNTIME_URL)) as {
    default: MgbaFactory
  }
  return loaded.default
})

/** Boots isolated, in-memory mGBA on the document's single runtime. */
export function startMgbaSession(
  options: MgbaSessionOptions
): Promise<MgbaSession> {
  return runtime.start(options)
}
