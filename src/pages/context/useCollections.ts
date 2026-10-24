import { useEffect, useSyncExternalStore } from 'react'
import { collections } from '../../services/collections'

export function useCollections() {
  const snapshot = useSyncExternalStore(
    collections.subscribe,
    collections.getSnapshot,
    collections.getSnapshot
  )
  useEffect(() => {
    void collections.initialize()
  }, [])
  return snapshot
}
