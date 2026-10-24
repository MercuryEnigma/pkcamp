import type { PokemonSaveAdapter } from './adapter'
import { initializePokemonSaveAdapter } from './adapter'
import { createPkhexWasmBackend } from './pkhexWasmBackend'

export interface PkhexRuntimeSnapshot {
  adapter: PokemonSaveAdapter | null
  loading: boolean
  error: Error | null
}

type AdapterFactory = () => Promise<PokemonSaveAdapter>

/** One lazy PKHeX runtime shared by every non-Arcade page and service. */
export class PkhexRuntime {
  private readonly createAdapter: AdapterFactory
  private snapshot: PkhexRuntimeSnapshot = {
    adapter: null,
    loading: true,
    error: null,
  }
  private pending: Promise<PokemonSaveAdapter> | null = null
  private readonly listeners = new Set<() => void>()

  constructor(createAdapter: AdapterFactory) {
    this.createAdapter = createAdapter
  }

  getSnapshot = (): PkhexRuntimeSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  ensure(): Promise<PokemonSaveAdapter> {
    if (this.snapshot.adapter) return Promise.resolve(this.snapshot.adapter)
    if (this.pending) return this.pending
    this.publish({ adapter: null, loading: true, error: null })
    const pending = this.createAdapter()
    this.pending = pending
    void pending.then(
      (adapter) => {
        if (this.pending !== pending) return
        this.pending = null
        this.publish({ adapter, loading: false, error: null })
      },
      (cause: unknown) => {
        if (this.pending !== pending) return
        this.pending = null
        this.publish({
          adapter: null,
          loading: false,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      }
    )
    return pending
  }

  retry(): Promise<PokemonSaveAdapter> {
    if (this.snapshot.adapter) return Promise.resolve(this.snapshot.adapter)
    this.pending = null
    return this.ensure()
  }

  private publish(snapshot: PkhexRuntimeSnapshot): void {
    this.snapshot = Object.freeze(snapshot)
    for (const listener of this.listeners) listener()
  }
}

export const pkhexRuntime = new PkhexRuntime(async () => {
  const backend = await createPkhexWasmBackend()
  return initializePokemonSaveAdapter({ backend })
})
