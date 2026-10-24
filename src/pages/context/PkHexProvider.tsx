import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { pkhexRuntime } from '../../services/pkhex'
import { PkHexContext } from './PkHexContext'

export function PkHexProvider({ children }: { children: ReactNode }) {
  const value = useSyncExternalStore(
    pkhexRuntime.subscribe,
    pkhexRuntime.getSnapshot,
    pkhexRuntime.getSnapshot
  )

  useEffect(() => {
    void pkhexRuntime.ensure().catch(() => {})
  }, [])

  return <PkHexContext.Provider value={value}>{children}</PkHexContext.Provider>
}
