import type { GameId, Generation } from '../saveLibrary'
import type { StorageProvider, StorageSettings } from './types'

export interface SettingsSnapshot {
  settings: StorageSettings | null
  error: Error | null
}

/** Share pending byte reads, never mutable parsed saves or editors. */
export class SharedLoads {
  private pending = new Map<string, Promise<unknown>>()

  read<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.pending.get(key)
    if (!pending) {
      pending = Promise.resolve().then(load)
      this.pending.set(key, pending)
      const clear = () => {
        if (this.pending.get(key) === pending) this.pending.delete(key)
      }
      void pending.then(clear, clear)
    }
    // Each caller receives its own bytes, Dates, and Camp positions.
    return pending.then((value) => structuredClone(value as T))
  }

  invalidate(key: string) {
    this.pending.delete(key)
  }
}

/** A save or Camp that was written or removed. */
export type DataChange =
  { kind: 'save'; gameId: GameId } | { kind: 'camp'; generation: Generation }

interface SharedProvider {
  provider: StorageProvider
  snapshot: SettingsSnapshot
  subscribe: (listener: () => void) => () => void
  subscribeData: (listener: (change: DataChange) => void) => () => void
}
const shared = new WeakMap<StorageProvider, SharedProvider>()

/** Stable provider wrapper; preserves the underlying persistence contract. */
export function shareStorageLoads(provider: StorageProvider): StorageProvider {
  const existing = shared.get(provider)
  if (existing) return existing.provider
  const loads = new SharedLoads()
  const listeners = new Set<() => void>()
  const dataListeners = new Set<(change: DataChange) => void>()
  const state: SharedProvider = {
    provider,
    snapshot: { settings: null, error: null },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    subscribeData: (listener) => {
      dataListeners.add(listener)
      return () => {
        dataListeners.delete(listener)
      }
    },
  }
  // Only after a write succeeds: a failed write left the data as it was.
  const changed = (change: DataChange) => {
    for (const listener of dataListeners) listener(change)
  }
  let settingsVersion = 0
  const publish = (settings: StorageSettings | null, error: Error | null) => {
    state.snapshot = {
      settings: settings ? Object.freeze({ ...settings }) : null,
      error,
    }
    for (const listener of listeners) listener()
  }
  const overrides: Partial<StorageProvider> = {
    getSave: (id) => loads.read(`save:${id}`, () => provider.getSave(id)),
    hasSave: (id) =>
      loads.read(`save-exists:${id}`, () => provider.hasSave(id)),
    hasRom: (id) => loads.read(`rom-exists:${id}`, () => provider.hasRom(id)),
    getCamp: (generation) =>
      loads.read(`camp:${generation}`, () => provider.getCamp(generation)),
    prefetch: () => loads.read('prefetch', () => provider.prefetch()),
    getSettings: async () => {
      if (state.snapshot.settings) return { ...state.snapshot.settings }
      const version = settingsVersion
      try {
        const settings = await loads.read('settings', () =>
          provider.getSettings()
        )
        if (version !== settingsVersion) return overrides.getSettings!()
        publish(settings, null)
        return settings
      } catch (cause) {
        if (version === settingsVersion)
          publish(
            null,
            cause instanceof Error ? cause : new Error(String(cause))
          )
        throw cause
      }
    },
    saveSettings: async (settings) => {
      // Detach pending reads before writing; old results must not republish.
      settingsVersion++
      loads.invalidate('settings')
      await provider.saveSettings(settings)
      settingsVersion++
      loads.invalidate('settings')
      publish(settings, null)
    },
    putSave: async (id, bytes) => {
      loads.invalidate(`save:${id}`)
      loads.invalidate(`save-exists:${id}`)
      try {
        await provider.putSave(id, bytes)
      } finally {
        loads.invalidate(`save:${id}`)
        loads.invalidate(`save-exists:${id}`)
      }
      changed({ kind: 'save', gameId: id })
    },
    putRom: async (id, rom) => {
      loads.invalidate(`rom-exists:${id}`)
      try {
        await provider.putRom(id, rom)
      } finally {
        loads.invalidate(`rom-exists:${id}`)
      }
    },
    discardRom: async (id) => {
      loads.invalidate(`rom-exists:${id}`)
      try {
        await provider.discardRom(id)
      } finally {
        loads.invalidate(`rom-exists:${id}`)
      }
    },
    discardSave: async (id) => {
      loads.invalidate(`save:${id}`)
      loads.invalidate(`save-exists:${id}`)
      try {
        await provider.discardSave(id)
      } finally {
        loads.invalidate(`save:${id}`)
        loads.invalidate(`save-exists:${id}`)
      }
      changed({ kind: 'save', gameId: id })
    },
    saveCamp: async (generation, camp) => {
      loads.invalidate(`camp:${generation}`)
      try {
        await provider.saveCamp(generation, camp)
      } finally {
        loads.invalidate(`camp:${generation}`)
      }
      changed({ kind: 'camp', generation })
    },
  }
  // Bind untouched methods to the original provider, including private fields.
  const bound = new Map<PropertyKey, unknown>()
  const wrapper = new Proxy(provider, {
    get(target, property) {
      if (Object.hasOwn(overrides, property))
        return Reflect.get(overrides, property)
      const value = Reflect.get(target, property, target)
      if (typeof value !== 'function') return value
      if (!bound.has(property)) bound.set(property, value.bind(target))
      return bound.get(property)
    },
  })
  state.provider = wrapper
  shared.set(provider, state)
  shared.set(wrapper, state)
  return wrapper
}

function settingsState(provider: StorageProvider): SharedProvider {
  shareStorageLoads(provider)
  return shared.get(provider)!
}
export function settingsSnapshot(provider: StorageProvider): SettingsSnapshot {
  return settingsState(provider).snapshot
}
export function subscribeSettings(
  provider: StorageProvider,
  listener: () => void
) {
  return settingsState(provider).subscribe(listener)
}

/** Calls `listener` after each save or Camp write through this provider. */
export function subscribeDataChanges(
  provider: StorageProvider,
  listener: (change: DataChange) => void
) {
  return settingsState(provider).subscribeData(listener)
}
