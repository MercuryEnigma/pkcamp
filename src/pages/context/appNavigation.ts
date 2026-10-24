import { createContext, useContext } from 'react'

export interface AppLocation {
  pathname: string
  search: string
}

export interface NavigateOptions {
  replace?: boolean
  /** Redirects and canonicalization do not represent a player leaving work. */
  guard?: boolean
}

export interface AppNavigation {
  location: AppLocation
  navigate: (href: string, options?: NavigateOptions) => boolean
}

export const AppNavigationContext = createContext<AppNavigation | null>(null)

export function useAppNavigation(): AppNavigation {
  const value = useContext(AppNavigationContext)
  if (!value) throw new Error('useAppNavigation requires NavigationProvider')
  return value
}
