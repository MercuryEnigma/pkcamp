import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { initPKHex } from 'pkhex-wasm'

const PkHexContext = createContext<any>(null)

export function PkHexProvider({ children }: { children: ReactNode }) {
  const [pkhex, setPkhex] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    initPKHex()
      .then(setPkhex)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PkHexContext.Provider value={{ pkhex, loading }}>
      {children}
    </PkHexContext.Provider>
  )
}

export function usePkHex() {
  return useContext(PkHexContext)
}
