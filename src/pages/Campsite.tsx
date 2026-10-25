import { useEffect, useRef, useState } from 'react'
import { StartMenu } from './hub/StartMenu'
import { WorldMap } from './hub/WorldMap'
import { useHubStartup } from './hub/useHubStartup'
import './pokestorage/camp.css'
import './hub/hub.css'
import { PokeStorageMain } from './pokestorage/PokeStorageMain'
import { LabMain } from './pokestorage/lab/LabMain'
import type { CampDestination } from './pokestorage/PokeStorageMain'
import { useAppNavigation } from './context/appNavigation'
import { resolveRoute, routeHref } from './routing'
import { activeGame } from '../services/activeGame'
import { guide } from '../services/guide'
import { usePkHex } from './context/PkHexContext'
import type { StorageProvider } from '../services/storage'

export function Campsite() {
  const startup = useHubStartup()
  const { adapter } = usePkHex()
  const { location, navigate } = useAppNavigation()
  const resolved = resolveRoute(location)
  const previousProvider = useRef<StorageProvider | null>(null)
  // A Lab entry opened its Cabin or Camp Site in the Camp Zone. The Lab stays
  // mounted (hidden) so Back returns to the same entry.
  const [fromLab, setFromLab] = useState<{
    id: number
    destination: CampDestination
  } | null>(null)
  const [labReturns, setLabReturns] = useState(0)

  const openInCamp = (destination: CampDestination) => {
    setFromLab((current) => ({ id: (current?.id ?? 0) + 1, destination }))
    const gameId =
      destination.name === 'cabin'
        ? destination.gameId
        : resolved.kind === 'route'
          ? resolved.route.gameId
          : null
    navigate(
      routeHref('camp', {
        gameId,
        mode: destination.name === 'cabin' ? 'move' : 'campsite',
      })
    )
  }
  const returnToLab = () => {
    setLabReturns((count) => count + 1)
    const gameId = resolved.kind === 'route' ? resolved.route.gameId : null
    navigate(routeHref('lab', { gameId, mode: 'collection' }))
  }

  useEffect(() => {
    if (resolved.kind === 'redirect') {
      navigate(resolved.href, { replace: true, guard: false })
      return
    }
    if (resolved.route.page === 'arcade') {
      window.location.replace(
        routeHref('arcade', { gameId: resolved.route.gameId })
      )
      return
    }
    if (
      resolved.route.page !== 'start' &&
      (startup.error || (startup.ready && !startup.sourceId))
    ) {
      navigate(routeHref('start'), { replace: true, guard: false })
    }
  }, [navigate, resolved, startup.error, startup.ready, startup.sourceId])

  const routePage = resolved.kind === 'route' ? resolved.route.page : null
  const routeGameId = resolved.kind === 'route' ? resolved.route.gameId : null
  // Reference loading starts with game selection, independently of PKHeX.
  // This service instance survives Hub, Camp and Lab route changes.
  useEffect(() => {
    if (startup.ready) void guide.select(routeGameId, startup.provider)
  }, [routeGameId, startup.provider, startup.ready])
  useEffect(() => {
    if (!startup.ready) return
    const providerChanged =
      previousProvider.current !== null &&
      previousProvider.current !== startup.provider
    previousProvider.current = startup.provider
    if (providerChanged) {
      activeGame.clear()
      navigate(routeHref('start'), { replace: true, guard: false })
      return
    }
    if (!adapter || !routePage) return
    if (routePage === 'arcade') {
      return
    }
    if (routePage === 'start' && !routeGameId) {
      activeGame.clear()
      return
    }
    void activeGame
      .select(routeGameId, startup.provider, adapter)
      .catch(() => {})
  }, [
    adapter,
    navigate,
    routeGameId,
    routePage,
    startup.provider,
    startup.ready,
  ])

  if (resolved.kind === 'redirect') return null
  const route = resolved.route
  if (route.page === 'arcade') return null
  if (route.page !== 'start' && (!startup.ready || !startup.sourceId))
    return null

  const toHub = () => {
    setFromLab(null)
    navigate(routeHref('hub', { gameId: route.gameId }))
  }

  return (
    <>
      {route.page === 'start' && (
        <StartMenu
          startup={startup}
          gameId={route.gameId}
          onChooseGame={(gameId) => navigate(routeHref('start', { gameId }))}
          onOpenGame={(gameId) => navigate(routeHref('hub', { gameId }))}
          onContinueWithoutSave={() => navigate(routeHref('hub'))}
          onCancelGame={() => navigate(routeHref('start'))}
        />
      )}
      {route.page === 'hub' && (
        <WorldMap
          gameId={route.gameId}
          onCamp={() =>
            navigate(routeHref('camp', { gameId: route.gameId, mode: 'move' }))
          }
          onLab={() => navigate(routeHref('lab', { gameId: route.gameId }))}
          onArcade={
            route.gameId
              ? () =>
                  window.location.assign(
                    routeHref('arcade', { gameId: route.gameId })
                  )
              : undefined
          }
          onBack={() => navigate(routeHref('start'))}
        />
      )}
      {route.page === 'camp' && (
        <PokeStorageMain
          key={fromLab?.id ?? 'camp'}
          onBack={toHub}
          destination={fromLab?.destination}
          onReturn={fromLab ? returnToLab : undefined}
        />
      )}
      {(route.page === 'lab' || fromLab) && (
        <LabMain
          hidden={route.page !== 'lab'}
          onBack={toHub}
          onOpenInCamp={openInCamp}
          campReturns={labReturns}
        />
      )}
    </>
  )
}
