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
import {
  loadCollectionSources,
  subscribeCollectionUpdates,
  updateCollections,
} from './collectionService'
import type {
  CabinScanStatus,
  CampScanStatus,
  CollectionDefinition,
  LabSourceId,
} from './collectionTypes'

export type ScanPhase = 'loading' | 'scanning' | 'idle'
export interface CollectionScanState {
  result: StoredCollectionResult | null
  phase: ScanPhase
  saves: Partial<Record<Gen3GameId, Date | null>> | null
  targets: Gen3GameId[]
  cabins: CabinScanStatus[]
  failedCabins: Gen3GameId[]
  /** Camp Pokémon stored in Gen 3 Camp Sites; null until loaded. */
  campCount: number | null
  /** Whether this scan includes Camp Sites. */
  campTarget: boolean
  /** The Camp Sites' last scan, when they were scanned. */
  camp: CampScanStatus | null
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
  campCount: number | null
  campTarget: boolean
  camp: CampScanStatus | null
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
  campCount: null,
  campTarget: false,
  camp: null,
  unsaved: false,
  waitingForPkHex: false,
}

/** One source snapshot for the dashboard and every collection workspace. */
export function useCollectionScans(
  definitions: readonly CollectionDefinition[],
  /** Selected sources, or null for every source that holds data. */
  selected: readonly LabSourceId[] | null,
  /** False until the stored selection has loaded; nothing scans before. */
  selectionReady = true
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
  const selectedKey = selected === null ? '*' : selected.join(',')

  // Results stored elsewhere (the hub's background update) are re-read here.
  const origin = useRef({})
  useEffect(
    () =>
      subscribeCollectionUpdates(provider, (from) => {
        if (from !== origin.current)
          setRequest((current) => ({
            id: current.id + 1,
            resetId: null,
            force: false,
          }))
      }),
    [provider]
  )

  useEffect(() => {
    if (!ready || !selectionReady) return
    let cancelled = false
    const requested = request.id !== handled.current
    handled.current = request.id
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
        const sources = await loadCollectionSources(provider, selected)
        if (cancelled) return
        update({
          saves: sources.saves,
          targets: sources.targets,
          campCount: sources.campCount,
          campTarget: sources.campTarget,
        })
        const outcome = await updateCollections({
          provider,
          adapter,
          definitions,
          sources,
          force: requested && request.force,
          resetId: requested ? request.resetId : null,
          readOnly: offline,
          origin: origin.current,
          onHistory: (results, errors) => update({ results, errors }),
          onScanning: () => update({ phase: 'scanning' }),
        })
        if (outcome.waitingForPkHex) {
          update({
            waitingForPkHex: true,
            phase: pkhexLoading ? 'loading' : 'idle',
          })
          return
        }
        update({
          phase: 'idle',
          results: outcome.results,
          errors: outcome.errors,
          cabins: outcome.cabins,
          camp: outcome.camp,
          unsaved: outcome.unsaved,
        })
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
    selectionReady,
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
        campCount: current.campCount,
        campTarget: current.campTarget,
        camp: current.camp,
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
