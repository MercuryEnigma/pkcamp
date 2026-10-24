import { useEffect, useState } from 'react'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { useAppNavigation } from '../../context/appNavigation'
import { SitePage } from '../../hub/SitePage'

import {
  routeHref,
  resolveRoute,
  type AppRoute,
  type LabMode,
} from '../../routing'
import { NavigationScopeProvider } from '../navigationGuard'
import type { CampDestination } from '../PokeStorageMain'
import { useStorageProvider } from '../useStorage'
import { CartridgeSaves } from './CartridgeSaves'
import { CollectionView } from './CollectionView'
import { LabMenu } from './LabMenu'
import { LabSettings } from './LabSettings'
import { MysteryGifts } from './MysteryGifts'
import { PatchNotes } from './PatchNotes'
import { PokeTransporter } from './PokeTransporter'
import { ResearchTools } from './ResearchTools'
import { RomBiosDumps } from './RomBiosDumps'

type LabRoute = Extract<AppRoute, { page: 'lab' }>

const TITLE: Record<LabMode, string> = {
  collection: 'PC',
  transporter: 'Transporter',
  tools: 'Research Tools',
  gifts: 'Mystery Gifts',
  saves: 'Cartridge Saves',
  dumps: 'ROM / BIOS Dumps',
  settings: 'Settings',
  news: 'Patch Notes',
}
/** Each mode's Back target; the three tools return to Research Tools. */
const PARENT: Record<LabMode, LabMode | null> = {
  collection: null,
  transporter: null,
  tools: null,
  gifts: 'tools',
  saves: 'tools',
  dumps: 'tools',
  settings: null,
  news: null,
}
/** Tasks that share one GB-Link session. */
const RESEARCH_MODES: ReadonlySet<LabMode | null> = new Set([
  'tools',
  'gifts',
  'saves',
  'dumps',
  'transporter',
])

/**
 * The Lab: its menu and every mode behind `/lab/?mode=`. The route decides
 * the page; this component stays mounted (hidden) while the player visits
 * Camp from a PC entry, so Back returns to the same entry.
 */
export function LabMain({
  onBack,
  onOpenInCamp,
  campReturns,
  hidden = false,
}: {
  /** Leaves the Lab for the Hub. */
  onBack: () => void
  /** Opens a PC entry's save or Camp Site match in Camp. */
  onOpenInCamp: (destination: CampDestination) => void
  /** Bumped each time the player comes back from Camp. */
  campReturns: number
  hidden?: boolean
}) {
  const { location, navigate } = useAppNavigation()
  const { provider } = useStorageProvider()
  const resolved = resolveRoute(location)
  const [route, setRoute] = useState<LabRoute>({
    page: 'lab',
    gameId: null,
    mode: null,
    tab: null,
  })
  // Keep the last Lab route while the Lab is hidden behind Camp.
  if (
    resolved.kind === 'route' &&
    resolved.route.page === 'lab' &&
    (resolved.route.gameId !== route.gameId ||
      resolved.route.mode !== route.mode ||
      resolved.route.tab !== route.tab)
  )
    setRoute(resolved.route)
  const { gameId, mode, tab } = route
  const go = (next: LabMode | null) =>
    navigate(routeHref('lab', { gameId, mode: next }))
  const inResearch = RESEARCH_MODES.has(mode)

  // Tasks release the GB-Link as they finish; this also covers leaving midway.
  useEffect(() => {
    if (!inResearch) return
    return () => {
      void gbLinkTradeDevice.disconnect().catch(() => {})
    }
  }, [inResearch])

  return (
    <NavigationScopeProvider value={!hidden}>
      <div hidden={hidden}>
        {mode === null ? (
          <LabMenu
            gameId={gameId}
            onBack={onBack}
            onSelectCollections={() => go('collection')}
            onSelectTransporter={() => go('transporter')}
            onSelectResearch={() => go('tools')}
            onSelectSettings={() => go('settings')}
            onSelectNews={() => go('news')}
          />
        ) : (
          <SitePage
            page={TITLE[mode]}
            gameId={gameId}
            onBack={() => go(PARENT[mode])}
          >
            {renderMode(mode)}
          </SitePage>
        )}
      </div>
    </NavigationScopeProvider>
  )

  function renderMode(current: LabMode) {
    switch (current) {
      case 'collection':
        return (
          <CollectionView
            onOpenInCamp={onOpenInCamp}
            campReturns={campReturns}
          />
        )
      case 'transporter':
        return <PokeTransporter />
      case 'tools':
        return (
          <ResearchTools
            onOpenGifts={() => go('gifts')}
            onOpenSaves={() => go('saves')}
            onOpenDumps={() => go('dumps')}
          />
        )
      case 'gifts':
        return <MysteryGifts />
      case 'saves':
        return <CartridgeSaves />
      case 'dumps':
        return <RomBiosDumps />
      case 'settings':
        return (
          <LabSettings
            key={`${tab ?? 'backups'}:${provider.id}`}
            tab={tab ?? 'backups'}
            onTabChange={(next) =>
              navigate(
                routeHref('lab', { gameId, mode: 'settings', tab: next }),
                { replace: true }
              )
            }
          />
        )
      case 'news':
        return <PatchNotes />
    }
  }
}
