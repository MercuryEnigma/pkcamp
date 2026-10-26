import { describe, expect, it } from 'vitest'
import type { SessionSave } from './arcadeSession'
import {
  canReloadFiles,
  createSaveSync,
  exitDecision,
  initialSync,
  nextWrite,
  syncReducer,
  unsyncedSave,
  type SyncEvent,
  type SyncState,
  type SyncWrite,
} from './arcadeSync'

/** The reducer compares bytes only; real saves are checked before this. */
function save(index: number): SessionSave {
  return { bytes: Uint8Array.of(index), saveIndex: index }
}

function run(state: SyncState, ...events: SyncEvent[]): SyncState {
  return events.reduce(syncReducer, state)
}

describe('syncReducer', () => {
  it('queues a game save and writes it once', () => {
    let state = run(initialSync(save(1).bytes), {
      type: 'game-saved',
      save: save(2),
    })
    expect(state.status).toBe('saving')
    expect(nextWrite(state)).toEqual(save(2))

    state = run(state, { type: 'write-started' })
    expect(nextWrite(state)).toBeNull()
    expect(unsyncedSave(state)).toEqual(save(2))

    state = run(state, { type: 'write-succeeded', at: 50 })
    expect(state).toMatchObject({
      baseline: save(2).bytes,
      status: 'saved',
      lastSyncedAt: 50,
    })
    expect(unsyncedSave(state)).toBeNull()
  })

  it('ignores a callback that repeats the save Camp or the queue holds', () => {
    const synced = initialSync(save(1).bytes)
    expect(run(synced, { type: 'game-saved', save: save(1) })).toBe(synced)
    const writing = run(
      synced,
      { type: 'game-saved', save: save(2) },
      { type: 'write-started' }
    )
    expect(run(writing, { type: 'game-saved', save: save(2) })).toBe(writing)
  })

  it('queues the newest save behind the write in flight', () => {
    const state = run(
      initialSync(null),
      { type: 'game-saved', save: save(2) },
      { type: 'write-started' },
      { type: 'game-saved', save: save(3) },
      { type: 'game-saved', save: save(4) }
    )
    expect(state.writing).toEqual(save(2))
    expect(state.pending).toEqual(save(4))
    expect(nextWrite(state)).toBeNull()

    const after = run(state, { type: 'write-succeeded', at: 1 })
    expect(after.status).toBe('saving')
    expect(nextWrite(after)).toEqual(save(4))
  })

  it('keeps the newest bytes when a write fails, and retries them', () => {
    const failed = run(
      initialSync(null),
      { type: 'game-saved', save: save(2) },
      { type: 'write-started' },
      { type: 'game-saved', save: save(3) },
      { type: 'write-failed', message: 'offline' }
    )
    expect(failed).toMatchObject({
      status: 'failed',
      message: 'offline',
      pending: save(3),
      writing: null,
    })
    expect(nextWrite(failed)).toBeNull()
    expect(nextWrite(run(failed, { type: 'retry' }))).toEqual(save(3))
    // A newer game save is a fresh request.
    expect(
      nextWrite(run(failed, { type: 'game-saved', save: save(4) }))
    ).toEqual(save(4))
  })

  it('pauses on a conflict until the player retries', () => {
    const conflict = run(
      initialSync(save(1).bytes),
      { type: 'game-saved', save: save(2) },
      { type: 'write-started' },
      { type: 'conflict' }
    )
    expect(conflict).toMatchObject({ status: 'conflict', pending: save(2) })
    expect(conflict.baseline).toEqual(save(1).bytes)

    const newer = run(conflict, { type: 'game-saved', save: save(3) })
    expect(newer.status).toBe('conflict')
    expect(nextWrite(newer)).toBeNull()
    expect(unsyncedSave(newer)).toEqual(save(3))

    expect(nextWrite(run(newer, { type: 'retry' }))).toEqual(save(3))
  })

  it('never syncs a loaded SAV until the game writes a different save', () => {
    const imported = run(initialSync(save(1).bytes), {
      type: 'imported',
      bytes: save(7).bytes,
    })
    expect(run(imported, { type: 'game-saved', save: save(7) })).toBe(imported)

    const rewritten = run(imported, { type: 'game-saved', save: save(8) })
    expect(rewritten.imported).toBeNull()
    expect(nextWrite(rewritten)).toEqual(save(8))
  })

  it('treats any game save after a blank loaded SAV as new', () => {
    const state = run(
      initialSync(save(1).bytes),
      { type: 'imported', bytes: null },
      { type: 'game-saved', save: save(2) }
    )
    expect(nextWrite(state)).toEqual(save(2))
  })

  it('starts over when Camp files are reloaded', () => {
    const state = run(
      initialSync(null),
      { type: 'game-saved', save: save(2) },
      { type: 'loaded', baseline: save(9).bytes }
    )
    expect(state).toEqual(initialSync(save(9).bytes))
  })
})

describe('canReloadFiles', () => {
  it('holds files while a game runs, a save is unsynced, or a SAV is loaded', () => {
    const clean = initialSync(null)
    expect(canReloadFiles(clean, false)).toBe(true)
    expect(canReloadFiles(clean, true)).toBe(false)
    expect(
      canReloadFiles(run(clean, { type: 'game-saved', save: save(2) }), false)
    ).toBe(false)
    expect(
      canReloadFiles(run(clean, { type: 'imported', bytes: null }), false)
    ).toBe(false)
  })

  it('keeps a failed save bound to its storage after a provider change', () => {
    // The player rereads files on a provider change only when this allows.
    const failed = run(
      initialSync(null),
      { type: 'game-saved', save: save(2) },
      { type: 'write-started' },
      { type: 'write-failed', message: 'offline' }
    )
    expect(canReloadFiles(failed, false)).toBe(false)
  })
})

describe('exitDecision', () => {
  it('leaves a clean, stopped session directly', () => {
    expect(exitDecision(initialSync(null), false)).toEqual({ kind: 'leave' })
  })

  it('asks, as information, while a synced game runs', () => {
    const synced = run(
      initialSync(null),
      { type: 'game-saved', save: save(2) },
      { type: 'write-started' },
      { type: 'write-succeeded', at: 5 }
    )
    expect(exitDecision(synced, true)).toMatchObject({
      kind: 'ask',
      severity: 'info',
      title: 'Did you save inside the game?',
      message: expect.stringContaining('is in Camp'),
    })
    expect(exitDecision(initialSync(null), true)).toMatchObject({
      severity: 'info',
      message: expect.stringContaining('not saved inside the game'),
    })
  })

  it('warns and offers recovery for a pending, failed, or conflicted save', () => {
    const pending = run(initialSync(null), {
      type: 'game-saved',
      save: save(2),
    })
    expect(exitDecision(pending, false)).toMatchObject({
      severity: 'warning',
      retry: false,
      download: true,
    })
    const failed = run(
      pending,
      { type: 'write-started' },
      { type: 'write-failed', message: 'x' }
    )
    expect(exitDecision(failed, true)).toMatchObject({
      severity: 'warning',
      retry: true,
      download: true,
    })
    const conflict = run(
      pending,
      { type: 'write-started' },
      { type: 'conflict' }
    )
    expect(exitDecision(conflict, false)).toMatchObject({
      severity: 'warning',
      retry: false,
      download: true,
      message: expect.stringContaining('changed elsewhere'),
    })
  })

  it('warns before dropping a loaded SAV the game has not saved', () => {
    expect(
      exitDecision(
        run(initialSync(null), { type: 'imported', bytes: null }),
        false
      )
    ).toMatchObject({ severity: 'warning', download: false })
  })
})

/** A write whose result the test settles by hand. */
function manualWrites() {
  const calls: {
    save: SessionSave
    baseline: Uint8Array | null
    resolve: (result: 'saved' | 'conflict') => void
    reject: (cause: unknown) => void
  }[] = []
  const write: SyncWrite = (save, baseline) =>
    new Promise((resolve, reject) =>
      calls.push({ save, baseline, resolve, reject })
    )
  return { calls, write }
}

const tick = () => new Promise((resolve) => setTimeout(resolve))

describe('createSaveSync', () => {
  const start = (write: SyncWrite, baseline: Uint8Array | null = null) => {
    const changes: SyncState[] = []
    const sync = createSaveSync({
      initial: initialSync(baseline),
      write,
      onChange: (state) => changes.push(state),
      errorMessage: (cause) => String(cause),
      now: () => 99,
    })
    return { sync, changes }
  }

  it('writes one save at a time and coalesces rapid saves', async () => {
    const { calls, write } = manualWrites()
    const { sync } = start(write, save(1).bytes)
    sync.dispatch({ type: 'game-saved', save: save(2) })
    sync.dispatch({ type: 'game-saved', save: save(3) })
    sync.dispatch({ type: 'game-saved', save: save(4) })
    expect(calls.map((call) => call.save)).toEqual([save(2)])
    expect(calls[0].baseline).toEqual(save(1).bytes)

    calls[0].resolve('saved')
    await tick()
    // Save 3 is skipped: only the newest queued save is written.
    expect(calls.map((call) => call.save)).toEqual([save(2), save(4)])
    expect(calls[1].baseline).toEqual(save(2).bytes)

    calls[1].resolve('saved')
    await tick()
    expect(sync.state).toMatchObject({
      status: 'saved',
      baseline: save(4).bytes,
      lastSyncedAt: 99,
    })
  })

  it('records failures and conflicts without writing again by itself', async () => {
    const { calls, write } = manualWrites()
    const { sync } = start(write)
    sync.dispatch({ type: 'game-saved', save: save(2) })
    calls[0].reject(new Error('offline'))
    await tick()
    expect(sync.state).toMatchObject({
      status: 'failed',
      message: 'Error: offline',
    })
    expect(calls).toHaveLength(1)

    sync.dispatch({ type: 'retry' })
    calls[1].resolve('conflict')
    await tick()
    expect(sync.state.status).toBe('conflict')
    expect(calls).toHaveLength(2)
  })

  it('drops the result of a write that a reload replaced', async () => {
    const { calls, write } = manualWrites()
    const { sync } = start(write)
    sync.dispatch({ type: 'game-saved', save: save(2) })
    sync.dispatch({ type: 'loaded', baseline: save(5).bytes })
    calls[0].resolve('saved')
    await tick()
    expect(sync.state).toEqual(initialSync(save(5).bytes))
  })

  it('stops reporting once closed', async () => {
    const { calls, write } = manualWrites()
    const { sync, changes } = start(write)
    sync.dispatch({ type: 'game-saved', save: save(2) })
    const seen = changes.length
    sync.close()
    calls[0].resolve('saved')
    await tick()
    expect(changes).toHaveLength(seen)
  })
})
