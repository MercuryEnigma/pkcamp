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
    scan.waitingForPkHex ||
    scan.offline
  )
    return 'partial'
  return 'ready'
}
export function researchSummary(scans: readonly CollectionScanState[]): {
  availability: ResearchAvailability
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
    owned: scans.reduce((sum, scan) => sum + (scan.result?.owned ?? 0), 0),
    available,
  }
}
