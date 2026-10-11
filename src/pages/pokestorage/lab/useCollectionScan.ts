import { useCallback, useEffect, useRef, useState } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type {
  StorageProvider,
  StoredCollectionResult,
} from '../../../services/storage'
import { usePkHex } from '../../context/PkHexContext'
import {
  storageErrorMessage,
  useStorageOffline,
  useStorageProvider,
} from '../useStorage'
import { isStale } from './collectionResults'
import type { CabinScanStatus, CollectionDefinition } from './collectionTypes'
import { GEN_3_GAMES } from './labStore'
import {
  evaluateResearchSnapshot,
  scanResearchSnapshot,
} from './researchSnapshot'

export type ScanPhase = 'loading' | 'scanning' | 'idle'
export interface CollectionScanState {
  result: StoredCollectionResult | null
  phase: ScanPhase
  saves: Partial<Record<Gen3GameId, Date | null>> | null
  targets: Gen3GameId[]
  cabins: CabinScanStatus[]
  failedCabins: Gen3GameId[]
  unsaved: boolean
  storageError: string | null
  offline: boolean
  waitingForPkHex: boolean
  rebuild(): void
  resetHistory(): void
}
interface ResearchState {
  provider: StorageProvider | null
  results: Record<string, StoredCollectionResult | null>
  errors: Record<string, string>
  phase: ScanPhase
  saves: CollectionScanState['saves']
  targets: Gen3GameId[]
  cabins: CabinScanStatus[]
  unsaved: boolean
  waitingForPkHex: boolean
}
const initial: ResearchState = {
  provider: null,
  results: {},
  errors: {},
  phase: 'loading',
  saves: null,
  targets: [],
  cabins: [],
  unsaved: false,
  waitingForPkHex: false,
}

/** One source snapshot for the dashboard and every collection workspace. */
export function useCollectionScans(
  definitions: readonly CollectionDefinition[],
  selected: readonly Gen3GameId[] | null
) {
  const { provider, ready } = useStorageProvider()
  const offline = useStorageOffline()
  const { adapter, loading: pkhexLoading } = usePkHex()
  const [state, setState] = useState<ResearchState>(initial)
  const [request, setRequest] = useState({
    id: 0,
    resetId: null as string | null,
    force: false,
  })
  const handled = useRef(0)
  const memory = useRef<{
    provider: StorageProvider
    key: string
    snapshot: Awaited<ReturnType<typeof scanResearchSnapshot>>
  } | null>(null)
  const selectedKey = selected === null ? '*' : selected.join(',')

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const requested = request.id !== handled.current
    handled.current = request.id
    const errors: Record<string, string> = {}
    const update = (patch: Partial<ResearchState>) => {
      if (!cancelled)
        setState((previous) => ({
          ...(previous.provider === provider ? previous : initial),
          provider,
          ...patch,
        }))
    }
    async function run() {
      update({
        phase: 'loading',
        errors: {},
        waitingForPkHex: false,
        unsaved: false,
      })
      try {
        const files = Object.fromEntries(
          await Promise.all(
            GEN_3_GAMES.map(
              async (id) => [id, await provider.getSave(id)] as const
            )
          )
        )
        if (cancelled) return
        const saves = Object.fromEntries(
          GEN_3_GAMES.map((id) => [id, files[id]?.updatedAt ?? null])
        )
        const targets = GEN_3_GAMES.filter(
          (id) => (selected === null || selected.includes(id)) && files[id]
        )
        update({ saves, targets })
        if (requested && request.resetId)
          await provider.discardCollectionResult(request.resetId)
        const history = Object.fromEntries(
          await Promise.all(
            definitions.map(async (definition) => {
              try {
                return [
                  definition.id,
                  await provider.getCollectionResult(definition.id),
                ] as const
              } catch (cause) {
                errors[definition.id] = storageErrorMessage(cause)
                return [definition.id, null] as const
              }
            })
          )
        )
        if (cancelled) return
        update({ results: history, errors })
        if (offline) {
          update({ phase: 'idle' })
          return
        }
        const stale = definitions.filter(
          (definition) =>
            (requested && request.force) ||
            !history[definition.id] ||
            isStale(history[definition.id]!, definition, targets, saves) !==
              null
        )
        if (stale.length === 0) {
          update({ phase: 'idle' })
          return
        }
        if (targets.length > 0 && !adapter) {
          update({
            waitingForPkHex: true,
            phase: pkhexLoading ? 'loading' : 'idle',
          })
          return
        }
        update({ phase: 'scanning' })
        const key = targets
          .map((id) => `${id}@${saves[id]?.getTime()}`)
          .join('|')
        let snapshot =
          memory.current?.provider === provider &&
          memory.current.key === key &&
          !(requested && request.force)
            ? memory.current.snapshot
            : null
        if (!snapshot) {
          snapshot =
            targets.length === 0
              ? { pokemon: [], cabins: [] }
              : await scanResearchSnapshot(provider, adapter!, targets, files)
          if (cancelled) return
          memory.current = snapshot.cabins.some(
            (cabin) => cabin.state === 'error'
          )
            ? null
            : { provider, key, snapshot }
        }
        const results = {
          ...history,
          ...evaluateResearchSnapshot(
            stale,
            snapshot,
            history,
            new Date().toISOString()
          ),
        }
        const partial = snapshot.cabins.some((cabin) => cabin.state === 'error')
        let unsaved = partial || targets.length === 0
        update({ results, cabins: snapshot.cabins, unsaved })
        if (!unsaved) {
          for (const definition of stale) {
            if (cancelled) return
            // Failed history reads must not overwrite history with a fresh empty baseline.
            if (errors[definition.id]) {
              unsaved = true
              continue
            }
            try {
              await provider.putCollectionResult(results[definition.id]!)
            } catch (cause) {
              errors[definition.id] = storageErrorMessage(cause)
              unsaved = true
            }
          }
        }
        update({ phase: 'idle', errors: { ...errors }, unsaved })
      } catch (cause) {
        update({
          phase: 'idle',
          errors: Object.fromEntries(
            definitions.map((definition) => [
              definition.id,
              storageErrorMessage(cause),
            ])
          ),
        })
      }
    }
    void run()
    return () => {
      cancelled = true
    }
    // selected is represented by selectedKey.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    definitions,
    selectedKey,
    provider,
    ready,
    adapter,
    pkhexLoading,
    offline,
    request,
  ])

  const refresh = useCallback(
    () =>
      setRequest((current) => ({
        id: current.id + 1,
        resetId: null,
        force: false,
      })),
    []
  )
  const rebuild = useCallback(
    () =>
      setRequest((current) => ({
        id: current.id + 1,
        resetId: null,
        force: true,
      })),
    []
  )
  const resetHistory = useCallback(
    (id: string) =>
      setRequest((current) => ({
        id: current.id + 1,
        resetId: id,
        force: false,
      })),
    []
  )
  const current = state.provider === provider ? state : initial
  const scans: Record<string, CollectionScanState> = Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      {
        result: current.results[definition.id] ?? null,
        phase: current.phase,
        saves: current.saves,
        targets: current.targets,
        cabins: current.cabins,
        failedCabins: current.cabins.flatMap((cabin) =>
          cabin.state === 'error' ? [cabin.gameId] : []
        ),
        unsaved: current.unsaved,
        storageError: current.errors[definition.id] ?? null,
        offline,
        waitingForPkHex: current.waitingForPkHex,
        rebuild,
        resetHistory: () => resetHistory(definition.id),
      },
    ])
  )
  return { scans, refresh }
}
