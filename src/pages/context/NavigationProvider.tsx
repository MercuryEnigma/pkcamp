import { useEffect, type ReactNode } from 'react'
import {
  NavigationActionsProvider,
  NavigationGuardProvider,
  useNavigationGuards,
} from '../pokestorage/navigationGuard'

/** Single navigation boundary shared by the hub, Camp, Lab and account actions. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const { register, confirmLeave, hasGuards } = useNavigationGuards()
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasGuards()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [hasGuards])
  return (
    <NavigationGuardProvider value={register}>
      <NavigationActionsProvider value={confirmLeave}>
        {children}
      </NavigationActionsProvider>
    </NavigationGuardProvider>
  )
}
