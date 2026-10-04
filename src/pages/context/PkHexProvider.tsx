import { useEffect, useState, type ReactNode } from 'react'
import {
  createPkhexWasmBackend,
  initializePokemonSaveAdapter,
} from '../../services/pkhex'
import { PkHexContext, type PkHexContextValue } from './PkHexContext'

export function PkHexProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<PkHexContextValue>({
    adapter: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    // The WASM runtime boots once; ignore the result if we unmount first.
    let cancelled = false

    createPkhexWasmBackend()
      .then((backend) => {
        if (cancelled) return
        setValue({
          adapter: initializePokemonSaveAdapter({ backend }),
          loading: false,
          error: null,
        })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setValue({
          adapter: null,
          loading: false,
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return <PkHexContext.Provider value={value}>{children}</PkHexContext.Provider>
}
