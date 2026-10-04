import { createContext, useContext } from 'react'
import type { PokemonSaveAdapter } from '../../services/pkhex'

export interface PkHexContextValue {
  /** Null while `loading`, or if initialization failed. */
  adapter: PokemonSaveAdapter | null
  loading: boolean
  error: Error | null
}

export const PkHexContext = createContext<PkHexContextValue>({
  adapter: null,
  loading: true,
  error: null,
})

export function usePkHex(): PkHexContextValue {
  return useContext(PkHexContext)
}
