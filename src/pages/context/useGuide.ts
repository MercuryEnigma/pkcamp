import { useSyncExternalStore } from 'react'
import { guide } from '../../services/guide'

/** Views subscribe to reference data initialized when the ROM is selected. */
export function useGuide() {
  return useSyncExternalStore(
    guide.subscribe,
    guide.getSnapshot,
    guide.getSnapshot
  )
}
