import { useCallback } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import type { StoredCollectionResult } from '../../../services/storage'
import { collections } from '../../../services/collections'
import { useActiveGame } from '../../context/useActiveGame'
import { useCollections } from '../../context/useCollections'
import { useStorageOffline } from '../useStorage'
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
  campCount: number | null
  campTarget: boolean
  camp: CampScanStatus | null
  unsaved: boolean
  storageError: string | null
  offline: boolean
  waitingForPkHex: boolean
  rebuild(): void
  resetHistory(): void
}

/** Transitional view adapter over the shared incremental collections service. */
export function useCollectionScans(
  definitions: readonly CollectionDefinition[],
  _selected: readonly LabSourceId[] | null,
  _selectionReady = true
) {
  const state = useCollections()
  const active = useActiveGame()
  const offline = useStorageOffline()
  const refresh = useCallback(() => {
    void collections.refresh()
  }, [])
  const phase: ScanPhase =
    state.status === 'scanning'
      ? 'scanning'
      : state.status === 'loading' || state.status === 'idle'
        ? 'loading'
        : 'idle'
  const activeResult = state.currentId ? state.results[state.currentId] : null
  const saves = Object.fromEntries(
    (activeResult?.sources ?? []).map((source) => [
      source.gameId,
      new Date(source.saveUpdatedAt),
    ])
  ) as Partial<Record<Gen3GameId, Date | null>>
  const campCount =
    active.camp?.sites.reduce(
      (total, site) =>
        total + site.filter((pokemon) => pokemon !== null).length,
      0
    ) ?? null
  const targets =
    active.gameId && active.saveBytes ? [active.gameId] : ([] as Gen3GameId[])
  const scans: Record<string, CollectionScanState> = Object.fromEntries(
    definitions.map((definition) => [
      definition.id,
      {
        result: state.results[definition.id] ?? null,
        phase,
        saves,
        targets,
        cabins: [],
        failedCabins: [],
        campCount,
        campTarget: true,
        camp: null,
        unsaved: Object.hasOwn(state.errors, definition.id),
        storageError: state.errors[definition.id] ?? null,
        offline,
        waitingForPkHex: false,
        rebuild: refresh,
        resetHistory: () => void collections.resetHistory(definition.id),
      },
    ])
  )
  return { scans, refresh }
}
