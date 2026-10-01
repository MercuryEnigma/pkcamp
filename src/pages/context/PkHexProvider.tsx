import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  createPkhexWasmBackend,
  initializePokemonSaveAdapter,
  type PokemonSaveAdapter,
} from '../../services/pkhex'

/**
 * What `usePkHex()` hands consumers.
 *
 * The provider owns the one-time WASM bootstrap and exposes the typed adapter
 * boundary (`src/services/pkhex`) rather than the raw `pkhex-wasm` root, so
 * pages code against the normalized types instead of the WASM surface.
 */
export interface PkHexContextValue {
  /** Null while `loading`, or if initialization failed. */
  adapter: PokemonSaveAdapter | null
  loading: boolean
  error: Error | null
}

const PkHexContext = createContext<PkHexContextValue>({
  adapter: null,
  loading: true,
  error: null,
})

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

export function usePkHex(): PkHexContextValue {
  return useContext(PkHexContext)
}
