import { ROSTER, type Gen3GameId } from '../services/saveLibrary'

export const SUPPORTED_GAMES = new Set(ROSTER[3] as readonly Gen3GameId[])

export type CampMode = 'move' | 'campsite' | 'trade'
export type LabMode =
  | 'collection'
  | 'transporter'
  | 'tools'
  | 'gifts'
  | 'saves'
  | 'dumps'
  | 'settings'
  | 'news'
export type SettingsTab =
  | 'backups'
  | 'appearance'
  | 'storage'
  | 'hardware'
  | 'arcade-controls'
  | 'arcade-skin'

export type AppRoute =
  | { page: 'start'; gameId: Gen3GameId | null }
  | { page: 'hub'; gameId: Gen3GameId | null }
  | { page: 'camp'; gameId: Gen3GameId | null; mode: CampMode }
  | {
      page: 'lab'
      gameId: Gen3GameId | null
      mode: LabMode | null
      tab: SettingsTab | null
    }
  | { page: 'arcade'; gameId: Gen3GameId }

export type RouteResolution =
  { kind: 'route'; route: AppRoute } | { kind: 'redirect'; href: string }

const CAMP_MODES = new Set<CampMode>(['move', 'campsite', 'trade'])
const LAB_MODES = new Set<LabMode>([
  'collection',
  'transporter',
  'tools',
  'gifts',
  'saves',
  'dumps',
  'settings',
  'news',
])
const SETTINGS_TABS = new Set<SettingsTab>([
  'backups',
  'appearance',
  'storage',
  'hardware',
  'arcade-controls',
  'arcade-skin',
])

function basePath(base: string): string {
  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`
}

function single(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name)
  return values.length <= 1 ? (values[0] ?? null) : '__duplicate__'
}

function gameFrom(params: URLSearchParams): Gen3GameId | null | undefined {
  const value = single(params, 'game')
  if (value === null) return null
  if (!value || !SUPPORTED_GAMES.has(value as Gen3GameId)) return undefined
  return value as Gen3GameId
}

function relativePage(pathname: string, base: string): string | null {
  const root = basePath(base)
  const rootWithoutSlash = root.slice(0, -1)
  if (pathname === rootWithoutSlash || pathname === root) return 'start'
  if (!pathname.startsWith(root)) return null
  const relative = pathname.slice(root.length).replace(/\/+$/, '')
  return relative || 'start'
}

export function routeHref(
  page: AppRoute['page'],
  options: {
    gameId?: Gen3GameId | null
    mode?: CampMode | LabMode | null
    tab?: SettingsTab | null
  } = {},
  base = import.meta.env.BASE_URL
): string {
  const root = basePath(base)
  const pathname = page === 'start' ? root : `${root}${page}/`
  const params = new URLSearchParams()
  if (options.gameId) params.set('game', options.gameId)
  if (options.mode) params.set('mode', options.mode)
  if (options.tab) params.set('tab', options.tab)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

/** Parses and canonicalizes every public pkCamp page URL. */
export function resolveRoute(
  location: Pick<Location, 'pathname' | 'search'>,
  base = import.meta.env.BASE_URL
): RouteResolution {
  const page = relativePage(location.pathname, base)
  const params = new URLSearchParams(location.search)
  const gameId = gameFrom(params)
  const toStart = (): RouteResolution => ({
    kind: 'redirect',
    href: routeHref('start', {}, base),
  })
  if (gameId === undefined || page === null) return toStart()

  const mode = single(params, 'mode')
  const tab = single(params, 'tab')
  switch (page) {
    case 'start':
      if (mode !== null || tab !== null) return toStart()
      return { kind: 'route', route: { page, gameId } }
    case 'hub':
      if (mode !== null || tab !== null) return toStart()
      return { kind: 'route', route: { page, gameId } }
    case 'camp': {
      if (tab !== null) return toStart()
      if (mode === null) {
        return {
          kind: 'redirect',
          href: routeHref('camp', { gameId, mode: 'move' }, base),
        }
      }
      if (!CAMP_MODES.has(mode as CampMode)) return toStart()
      if (mode === 'campsite' && gameId === null) {
        return {
          kind: 'redirect',
          href: routeHref('camp', { mode: 'move' }, base),
        }
      }
      return {
        kind: 'route',
        route: { page, gameId, mode: mode as CampMode },
      }
    }
    case 'lab': {
      if (mode !== null && !LAB_MODES.has(mode as LabMode)) return toStart()
      if (tab !== null) {
        if (mode !== 'settings' || !SETTINGS_TABS.has(tab as SettingsTab))
          return toStart()
      }
      return {
        kind: 'route',
        route: {
          page,
          gameId,
          mode: mode as LabMode | null,
          tab: tab as SettingsTab | null,
        },
      }
    }
    case 'arcade':
      if (mode !== null || tab !== null) return toStart()
      if (gameId === null) {
        return {
          kind: 'redirect',
          href: routeHref('hub', {}, base),
        }
      }
      return { kind: 'route', route: { page, gameId } }
    default:
      return toStart()
  }
}
