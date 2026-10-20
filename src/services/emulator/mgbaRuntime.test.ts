import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMgbaRuntime,
  type MgbaFactory,
  type MgbaModule,
  type MgbaSessionOptions,
} from './mgbaRuntime'

/**
 * Records calls in order and keeps a tiny in-memory filesystem. Like mGBA,
 * each loadGame creates a fresh core without callbacks, and callbacks
 * registered while no core exists are ignored.
 */
function fakeModule(loadResult = true) {
  const files = new Map<string, Uint8Array>()
  const calls: string[] = []
  let hasCore = false
  let callbacks: {
    saveDataUpdatedCallback?(): void
    coreCrashedCallback?(): void
  } = {}
  const module: MgbaModule = {
    FS: {
      analyzePath: (path) => ({ exists: files.has(path) }),
      mkdir: (path) => void files.set(path, new Uint8Array()),
      unlink: (path) => {
        calls.push(`unlink ${path}`)
        files.delete(path)
      },
      writeFile: (path, bytes) => {
        calls.push(`write ${path}`)
        files.set(path, bytes)
      },
    },
    addCoreCallbacks: (next) => {
      calls.push('addCoreCallbacks')
      if (hasCore) callbacks = { ...next }
    },
    buttonPress: (button) => void calls.push(`press ${button}`),
    buttonUnpress: (button) => void calls.push(`unpress ${button}`),
    getSave: () => files.get('/data/saves/arcade.sav') ?? null,
    loadGame: () => {
      calls.push('loadGame')
      hasCore = loadResult
      callbacks = {}
      return loadResult
    },
    pauseGame: () => void calls.push('pause'),
    quickReload: () => void calls.push('reset'),
    setFastForwardMultiplier: (multiplier) =>
      void calls.push(`speed ${multiplier}`),
    quitGame: () => {
      calls.push('quit')
      hasCore = false
    },
    resumeGame: () => void calls.push('resume'),
    setCoreSettings: (settings) =>
      void calls.push(`settings ${JSON.stringify(settings)}`),
    setVolume: (volume) => void calls.push(`volume ${volume}`),
    toggleInput: (enabled) => void calls.push(`input ${enabled}`),
  }
  return {
    module,
    calls,
    files,
    /** The callbacks the current core would call. */
    get callbacks() {
      return callbacks
    },
  }
}

const canvas = {} as HTMLCanvasElement

function options(overrides: Partial<MgbaSessionOptions> = {}) {
  return {
    canvas,
    rom: new Uint8Array([1]),
    onSaveChanged: vi.fn(),
    onCrash: vi.fn(),
    ...overrides,
  }
}

function runtimeWith(fake: ReturnType<typeof fakeModule>) {
  const factory = vi.fn<MgbaFactory>(async () => fake.module)
  const load = vi.fn(async () => factory)
  return { runtime: createMgbaRuntime(load), load, factory }
}

describe('mGBA runtime', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not load a game when startup is cancelled during module initialization', async () => {
    const fake = fakeModule()
    let resolveFactory!: (factory: MgbaFactory) => void
    const factoryReady = new Promise<MgbaFactory>((resolve) => {
      resolveFactory = resolve
    })
    const runtime = createMgbaRuntime(() => factoryReady)
    const controller = new AbortController()
    const starting = runtime.start(options({ signal: controller.signal }))
    await Promise.resolve()
    controller.abort()
    resolveFactory(async () => fake.module)
    await expect(starting).rejects.toMatchObject({ name: 'AbortError' })
    expect(fake.calls).not.toContain('loadGame')
    await expect(runtime.start(options())).resolves.toBeDefined()
  })

  it('creates one module for repeated and overlapping starts', async () => {
    const fake = fakeModule()
    const { runtime, factory } = runtimeWith(fake)

    await Promise.all([runtime.start(options()), runtime.start(options())])
    const third = await runtime.start(options())
    third.stop()
    await runtime.start(options())

    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('attaches core callbacks after every load, when a core exists', async () => {
    const fake = fakeModule()
    const { runtime } = runtimeWith(fake)

    for (let i = 0; i < 2; i++) {
      await runtime.start(options())
      const load = fake.calls.lastIndexOf('loadGame')
      expect(fake.calls.indexOf('addCoreCallbacks', load)).toBeGreaterThan(load)
      expect(fake.callbacks.saveDataUpdatedCallback).toBeDefined()
    }
  })

  it('disables auto save states and rewind before loading, then mGBA input', async () => {
    const fake = fakeModule()
    await runtimeWith(fake).runtime.start(options())

    const settings = fake.calls.findIndex((call) => call.startsWith('settings'))
    expect(JSON.parse(fake.calls[settings].slice('settings '.length))).toEqual({
      autoSaveStateEnable: false,
      restoreAutoSaveStateOnLoad: false,
      rewindEnable: false,
    })
    expect(settings).toBeLessThan(fake.calls.indexOf('loadGame'))
    expect(fake.calls.indexOf('input false')).toBeGreaterThan(
      fake.calls.indexOf('loadGame')
    )
  })

  it('removes the previous session save when a new game has none', async () => {
    const fake = fakeModule()
    const { runtime } = runtimeWith(fake)

    const first = await runtime.start(options({ save: new Uint8Array([9]) }))
    expect(first.getSave()).toEqual(new Uint8Array([9]))
    first.stop()

    const second = await runtime.start(options())
    expect(fake.calls).toContain('unlink /data/saves/arcade.sav')
    expect(second.getSave()).toBeNull()
  })

  it('stops idempotently, and a stale session never stops a newer one', async () => {
    const fake = fakeModule()
    const { runtime } = runtimeWith(fake)

    const first = await runtime.start(options())
    const second = await runtime.start(options())
    const quitsAfterReplace = fake.calls.filter(
      (call) => call === 'quit'
    ).length

    first.stop()
    first.setButton('a', true)
    expect(first.getSave()).toBeNull()
    expect(fake.calls.filter((call) => call === 'quit')).toHaveLength(
      quitsAfterReplace
    )

    second.stop()
    second.stop()
    expect(fake.calls.filter((call) => call === 'quit')).toHaveLength(
      quitsAfterReplace + 1
    )
    expect(fake.calls).not.toContain('press a')
  })

  it('delivers core callbacks later and drops them after stop', async () => {
    const fake = fakeModule()
    const { runtime } = runtimeWith(fake)
    const live = options()
    const session = await runtime.start(live)

    fake.callbacks.saveDataUpdatedCallback?.()
    expect(live.onSaveChanged).not.toHaveBeenCalled()
    await vi.runAllTimersAsync()
    expect(live.onSaveChanged).toHaveBeenCalledTimes(1)

    fake.callbacks.saveDataUpdatedCallback?.()
    fake.callbacks.coreCrashedCallback?.()
    session.stop()
    await vi.runAllTimersAsync()
    expect(live.onSaveChanged).toHaveBeenCalledTimes(1)
    expect(live.onCrash).not.toHaveBeenCalled()
  })

  it('routes callbacks only to the current session', async () => {
    const fake = fakeModule()
    const { runtime } = runtimeWith(fake)
    const old = options()
    const current = options()
    await runtime.start(old)
    const retainedOldCallback = fake.callbacks.saveDataUpdatedCallback
    await runtime.start(current)

    retainedOldCallback?.()
    fake.callbacks.saveDataUpdatedCallback?.()
    await vi.runAllTimersAsync()
    expect(old.onSaveChanged).not.toHaveBeenCalled()
    expect(current.onSaveChanged).toHaveBeenCalledTimes(1)
  })

  it('cleans up when mGBA rejects the ROM', async () => {
    const fake = fakeModule(false)
    const { runtime } = runtimeWith(fake)
    const rejected = options()

    await expect(runtime.start(rejected)).rejects.toThrow('could not load')
    expect(fake.calls.at(-1)).toBe('quit')
    fake.callbacks.saveDataUpdatedCallback?.()
    await vi.runAllTimersAsync()
    expect(rejected.onSaveChanged).not.toHaveBeenCalled()
  })

  it('retries loading after a failed download', async () => {
    const fake = fakeModule()
    const factory = vi.fn<MgbaFactory>(async () => fake.module)
    const load = vi
      .fn<() => Promise<MgbaFactory>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(factory)
    const runtime = createMgbaRuntime(load)

    await expect(runtime.start(options())).rejects.toThrow('offline')
    await expect(runtime.start(options())).resolves.toBeDefined()
    expect(load).toHaveBeenCalledTimes(2)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('clamps speed and volume, and ignores controls after stop', async () => {
    const fake = fakeModule()
    const session = await runtimeWith(fake).runtime.start(options())

    session.setSpeed(2.6)
    session.setSpeed(0)
    session.setSpeed(0.5)
    session.setVolume(1.5)
    session.setVolume(-1)
    session.reset()
    expect(fake.calls.slice(-6)).toEqual([
      'speed 3',
      'speed 1',
      'speed -2',
      'volume 1',
      'volume 0',
      'reset',
    ])

    session.stop()
    const count = fake.calls.length
    session.reset()
    session.setSpeed(2)
    session.setVolume(0.5)
    session.pause()
    expect(fake.calls).toHaveLength(count)
  })

  it('refuses to rebind the module to a different screen', async () => {
    const { runtime } = runtimeWith(fakeModule())
    await runtime.start(options())
    await expect(
      runtime.start(options({ canvas: {} as HTMLCanvasElement }))
    ).rejects.toThrow('another screen')
  })
})
