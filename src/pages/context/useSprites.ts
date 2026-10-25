import { useSyncExternalStore } from 'react'
import { sprites } from '../../services/sprites/resources'

/** Views subscribe to the sprite source selected at app startup. */
export function useSprites() {
  return useSyncExternalStore(
    sprites.subscribe,
    sprites.getSnapshot,
    sprites.getSnapshot
  )
}
