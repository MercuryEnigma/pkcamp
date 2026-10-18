import { registeredCount } from './collectionTypes'
import type { CollectionScanState } from './useCollectionScan'

export type ResearchAvailability =
  'loading' | 'ready' | 'partial' | 'unavailable'
export function researchAvailability(
  scan: CollectionScanState
): ResearchAvailability {
  if (scan.phase !== 'idle') return 'loading'
  if (!scan.result) return 'unavailable'
  if (
    scan.storageError ||
    scan.failedCabins.length ||
    scan.camp?.state === 'error' ||
    scan.waitingForPkHex ||
    scan.offline
  )
    return 'partial'
  return 'ready'
}
export function researchSummary(scans: readonly CollectionScanState[]): {
  availability: ResearchAvailability
  /** Registered entries: owned or seen. */
  owned: number
  available: number
} {
  const statuses = scans.map(researchAvailability)
  const available = scans.filter((scan) => scan.result !== null).length
  return {
    availability: statuses.includes('loading')
      ? 'loading'
      : available === 0
        ? 'unavailable'
        : statuses.every((status) => status === 'ready')
          ? 'ready'
          : 'partial',
    owned: scans.reduce(
      (sum, scan) => sum + (scan.result ? registeredCount(scan.result) : 0),
      0
    ),
    available,
  }
}
