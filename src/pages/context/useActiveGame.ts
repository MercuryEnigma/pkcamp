import { useSyncExternalStore } from 'react'
import { activeGame } from '../../services/activeGame'

/** Reactive access to the app-lifetime selected save and Camp state. */
export function useActiveGame() {
  return useSyncExternalStore(
    activeGame.subscribe,
    activeGame.getSnapshot,
    activeGame.getSnapshot
  )
}
