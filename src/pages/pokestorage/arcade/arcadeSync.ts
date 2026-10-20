import { equalBytes, type SessionSave } from './arcadeSession'

/**
 * Auto-sync of in-game saves to Camp. Each settled, complete save from the
 * game becomes the pending save; the player writes one save at a time to the
 * storage captured at Start, so an older write can never land after a newer
 * one. Every write first compares Camp's save with `baseline` and refuses to
 * overwrite a save changed elsewhere.
 */
export type SyncStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict'

export interface SyncState {
  /** Camp's save as last read or confirmed written. */
  baseline: Uint8Array | null
  /** Newest validated save that is not being written yet. */
  pending: SessionSave | null
  /** The save being written now. */
  writing: SessionSave | null
  /**
   * A SAV file loaded for this session (`bytes` null for a blank one). Its
   * bytes never sync; only a different save written by the game does.
   */
  imported: { bytes: Uint8Array | null } | null
  status: SyncStatus
  /** Why the last write failed. */
  message: string | null
  /** When storage last confirmed a write (ms since epoch). */
  lastSyncedAt: number | null
}

export type SyncEvent =
  /** Camp's files were (re)read; starts over from their save. */
  | { type: 'loaded'; baseline: Uint8Array | null }
  /** "Load SAV file": the next game boots from these bytes. */
  | { type: 'imported'; bytes: Uint8Array | null }
  /** A settled save callback produced a complete save. */
  | { type: 'game-saved'; save: SessionSave }
  | { type: 'write-started' }
  | { type: 'write-succeeded'; at: number }
  | { type: 'write-failed'; message: string }
  | { type: 'conflict' }
  /** The player asked to try a failed or refused write again. */
  | { type: 'retry' }

export function initialSync(baseline: Uint8Array | null): SyncState {
  return {
    baseline,
    pending: null,
    writing: null,
    imported: null,
    status: 'idle',
    message: null,
    lastSyncedAt: null,
  }
}

/** The newest save Camp does not have yet, if any. */
export function unsyncedSave(state: SyncState): SessionSave | null {
  return state.pending ?? state.writing
}

export function syncReducer(state: SyncState, event: SyncEvent): SyncState {
  switch (event.type) {
    case 'loaded':
      return initialSync(event.baseline)
    case 'imported':
      // `lastSyncedAt` resets too: the next game boots from the file.
      return {
        ...initialSync(state.baseline),
        imported: { bytes: event.bytes },
      }
    case 'game-saved': {
      const { save } = event
      // The loaded file itself is not a rewrite by the game.
      if (state.imported && equalBytes(save.bytes, state.imported.bytes)) {
        return state
      }
      const newest = unsyncedSave(state)?.bytes ?? state.baseline
      if (equalBytes(save.bytes, newest)) {
        return state.imported ? { ...state, imported: null } : state
      }
      return {
        ...state,
        pending: save,
        imported: null,
        // A conflict stays paused until the player chooses; a failed write
        // is retried by the next save.
        status: state.status === 'conflict' ? 'conflict' : 'saving',
        message: state.status === 'conflict' ? state.message : null,
      }
    }
    case 'write-started':
      if (!state.pending || state.writing) return state
      return {
        ...state,
        pending: null,
        writing: state.pending,
        status: 'saving',
      }
    case 'write-succeeded':
      if (!state.writing) return state
      return {
        ...state,
        baseline: state.writing.bytes,
        writing: null,
        status: state.pending ? 'saving' : 'saved',
        message: null,
        lastSyncedAt: event.at,
      }
    case 'write-failed':
    case 'conflict':
      return {
        ...state,
        // Keep the newest bytes: a queued save is newer than the failed one.
        pending: state.pending ?? state.writing,
        writing: null,
        status: event.type === 'conflict' ? 'conflict' : 'failed',
        message: event.type === 'write-failed' ? event.message : null,
      }
    case 'retry':
      if (
        !state.pending ||
        (state.status !== 'failed' && state.status !== 'conflict')
      ) {
        return state
      }
      return { ...state, status: 'saving', message: null }
  }
}

/** The save to write next, or null while one is in flight or paused. */
export function nextWrite(state: SyncState): SessionSave | null {
  if (state.writing || state.status !== 'saving') return null
  return state.pending
}

/**
 * Whether Camp's files may be reread, e.g. after a storage change. Never
 * while a game runs or holds a save that Camp lacks, or over a loaded SAV.
 */
export function canReloadFiles(state: SyncState, running: boolean): boolean {
  return !running && !unsyncedSave(state) && !state.imported
}

/** What leaving (or replacing the game) would cost, for the exit dialog. */
export type ExitDecision =
  | { kind: 'leave' }
  | {
      kind: 'ask'
      /** `warning` when something would be lost that Camp does not have. */
      severity: 'info' | 'warning'
      title: string
      message: string
      /** Offer Try again (a failed write). */
      retry: boolean
      /** Offer Download SAV (the unsynced save). */
      download: boolean
    }

export function exitDecision(state: SyncState, running: boolean): ExitDecision {
  const title = running
    ? 'Did you save inside the game?'
    : 'Your save is not in Camp'
  const warn = (message: string, retry = false, download = true) =>
    ({
      kind: 'ask',
      severity: 'warning',
      title,
      message,
      retry,
      download,
    }) as const
  if (state.status === 'conflict' && state.pending) {
    return warn(
      'The save in Camp was changed somewhere else, so this game’s save was not copied over it. Download SAV to keep this game’s save, or it will be lost.'
    )
  }
  if (state.status === 'failed' && state.pending) {
    return warn(
      'Your latest game save could not be saved to Camp. Try again or Download SAV, or it will be lost.',
      true
    )
  }
  if (unsyncedSave(state)) {
    return warn(
      'Your latest game save is still being saved to Camp. Wait for “Saved!” before leaving, or it may be lost.'
    )
  }
  if (state.imported) {
    return warn(
      'The SAV file you loaded is not in Camp. Save inside the game to keep your progress there.',
      false,
      false
    )
  }
  if (!running) return { kind: 'leave' }
  return {
    kind: 'ask',
    severity: 'info',
    title,
    message:
      state.lastSyncedAt === null
        ? 'You have not saved inside the game since you started. Anything since your last save will be lost.'
        : 'Your last game save is in Camp. Anything since then will be lost.',
    retry: false,
    download: false,
  }
}

/** Writes `save` if Camp still holds `baseline`; 'conflict' if not. */
export type SyncWrite = (
  save: SessionSave,
  baseline: Uint8Array | null
) => Promise<'saved' | 'conflict'>

export interface SaveSync {
  readonly state: SyncState
  dispatch(event: SyncEvent): void
  /** Stops delivering results, e.g. when the player unmounts. */
  close(): void
}

/**
 * Runs `syncReducer` and performs its writes one at a time. A write's result
 * is applied only if no `loaded` or `imported` event replaced the state it
 * started from.
 */
export function createSaveSync(options: {
  initial: SyncState
  write: SyncWrite
  onChange: (state: SyncState) => void
  errorMessage: (cause: unknown) => string
  now?: () => number
}): SaveSync {
  const now = options.now ?? Date.now
  let state = options.initial
  let generation = 0
  let inFlight = false
  let closed = false

  const apply = (event: SyncEvent) => {
    if (closed) return
    if (event.type === 'loaded' || event.type === 'imported') generation++
    const next = syncReducer(state, event)
    if (next === state) return
    state = next
    options.onChange(state)
  }

  const pump = () => {
    if (closed || inFlight) return
    const save = nextWrite(state)
    if (!save) return
    const started = generation
    const baseline = state.baseline
    inFlight = true
    apply({ type: 'write-started' })
    options.write(save, baseline).then(
      (result) =>
        settle(
          started,
          result === 'saved'
            ? { type: 'write-succeeded', at: now() }
            : { type: 'conflict' }
        ),
      (cause) =>
        settle(started, {
          type: 'write-failed',
          message: options.errorMessage(cause),
        })
    )
  }

  const settle = (started: number, event: SyncEvent) => {
    inFlight = false
    if (started === generation) apply(event)
    pump()
  }

  return {
    get state() {
      return state
    },
    dispatch(event) {
      apply(event)
      pump()
    },
    close() {
      closed = true
    },
  }
}
