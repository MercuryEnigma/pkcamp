import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  NavigationActionsProvider,
  NavigationGuardProvider,
  useNavigationGuards,
} from '../pokestorage/navigationGuard'
import {
  AppNavigationContext,
  type AppLocation,
  type NavigateOptions,
} from './appNavigation'
const HISTORY_INDEX = '__pkcampHistoryIndex'

function currentLocation(): AppLocation {
  return { pathname: window.location.pathname, search: window.location.search }
}

function historyIndex(state: unknown): number | null {
  if (!state || typeof state !== 'object') return null
  const value = Reflect.get(state, HISTORY_INDEX)
  return typeof value === 'number' ? value : null
}

function indexedState(index: number): Record<string, unknown> {
  const state = window.history.state
  return {
    ...(state && typeof state === 'object' ? state : {}),
    [HISTORY_INDEX]: index,
  }
}

/** Single navigation boundary shared by the hub, Camp, Lab and account actions. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const { register, confirmLeave, hasGuards } = useNavigationGuards()
  const [location, setLocation] = useState(currentLocation)
  const currentIndex = useRef(historyIndex(window.history.state) ?? 0)
  const restoring = useRef(false)

  const navigate = useCallback(
    (href: string, options: NavigateOptions = {}) => {
      if (options.guard !== false && !confirmLeave()) return false
      if (options.replace) {
        window.history.replaceState(
          indexedState(currentIndex.current),
          '',
          href
        )
      } else {
        currentIndex.current += 1
        window.history.pushState(indexedState(currentIndex.current), '', href)
      }
      setLocation(currentLocation())
      return true
    },
    [confirmLeave]
  )

  useEffect(() => {
    if (historyIndex(window.history.state) === null) {
      window.history.replaceState(
        indexedState(currentIndex.current),
        '',
        window.location.href
      )
    }

    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasGuards()) return
      event.preventDefault()
      event.returnValue = ''
    }
    const popState = (event: PopStateEvent) => {
      const nextIndex = historyIndex(event.state)
      if (restoring.current) {
        restoring.current = false
        if (nextIndex !== null) currentIndex.current = nextIndex
        setLocation(currentLocation())
        return
      }
      if (confirmLeave()) {
        if (nextIndex !== null) currentIndex.current = nextIndex
        setLocation(currentLocation())
        return
      }

      if (nextIndex === null) {
        // A same-document entry from before pkCamp initialized cannot be
        // addressed safely. Keep the current app URL and draft in place.
        window.history.replaceState(
          indexedState(currentIndex.current),
          '',
          `${location.pathname}${location.search}`
        )
        return
      }
      const delta = currentIndex.current - nextIndex
      if (delta === 0) return
      restoring.current = true
      window.history.go(delta)
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', popState)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', popState)
    }
  }, [confirmLeave, hasGuards, location.pathname, location.search])

  return (
    <NavigationGuardProvider value={register}>
      <NavigationActionsProvider value={confirmLeave}>
        <AppNavigationContext.Provider value={{ location, navigate }}>
          {children}
        </AppNavigationContext.Provider>
      </NavigationActionsProvider>
    </NavigationGuardProvider>
  )
}
