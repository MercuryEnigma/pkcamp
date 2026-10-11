import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react'

export type LeaveGuard = () => boolean
const NavigationGuardContext = createContext<
  ((guard: LeaveGuard) => () => void) | null
>(null)
export const NavigationGuardProvider = NavigationGuardContext.Provider

/** Registers the mounted screen's guard for navigation outside that screen. */
export function useNavigationGuard(blocked: boolean, message: string) {
  const register = useContext(NavigationGuardContext)
  useEffect(
    () => register?.(() => !blocked || window.confirm(message)),
    [register, blocked, message]
  )
}

export function useNavigationGuards() {
  const guards = useRef(new Set<LeaveGuard>())
  const register = useCallback((guard: LeaveGuard) => {
    guards.current.add(guard)
    return () => {
      guards.current.delete(guard)
    }
  }, [])
  const confirmLeave = useCallback(
    () => confirmNavigation([...guards.current]),
    []
  )
  return useMemo(() => ({ register, confirmLeave }), [register, confirmLeave])
}

export function confirmNavigation(guards: readonly LeaveGuard[]): boolean {
  return guards.every((guard) => guard())
}
