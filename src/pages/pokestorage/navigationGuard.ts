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
const NavigationActionsContext = createContext<LeaveGuard>(() => true)
const NavigationScopeContext = createContext(true)
export const NavigationGuardProvider = NavigationGuardContext.Provider
export const NavigationActionsProvider = NavigationActionsContext.Provider
/** Hidden, preserved screens do not guard actions in the visible zone. */
export const NavigationScopeProvider = NavigationScopeContext.Provider

export function useConfirmNavigation(): LeaveGuard {
  return useContext(NavigationActionsContext)
}

/** One guard mechanism for edits, save replacement, trades and device tasks. */
export function useNavigationGuard(blocked: boolean, message: string) {
  const register = useContext(NavigationGuardContext)
  const active = useContext(NavigationScopeContext)
  useEffect(() => {
    if (blocked && active) return register?.(() => window.confirm(message))
  }, [register, blocked, active, message])
  return useConfirmNavigation()
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
  const hasGuards = useCallback(() => guards.current.size > 0, [])
  return useMemo(
    () => ({ register, confirmLeave, hasGuards }),
    [register, confirmLeave, hasGuards]
  )
}

export function confirmNavigation(guards: readonly LeaveGuard[]): boolean {
  return guards.every((guard) => guard())
}
