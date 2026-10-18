import { useEffect, useState } from 'react'
import { gbLinkTradeDevice } from '../../../services/tradeDevice'
import { NavigationScopeProvider } from '../navigationGuard'
import { NewsPage } from '../../NewsPage'
import '../camp.css'
import { DropboxBadge } from '../DropboxBadge'
import { SourceLink } from '../../hub/SourceLink'
import type { CampDestination } from '../PokeStorageMain'
import { useStorageProvider } from '../useStorage'
import { CollectionView } from './CollectionView'
import './lab.css'
import { LabMenu } from './LabMenu'
import { LabSettings, type SettingsTab } from './LabSettings'
import { LabTradeTable } from './LabTradeTable'
import { ResearchTools } from './ResearchTools'
import { CartridgeSaves } from './CartridgeSaves'
import { RomBiosDumps } from './RomBiosDumps'
import { MysteryGifts } from './MysteryGifts'
import { PokeTransporter } from './PokeTransporter'
import './labZone.css'

type Screen =
  | { name: 'menu' }
  | { name: 'collections' }
  | { name: 'trade' }
  | { name: 'research' }
  | { name: 'cartridge-saves' }
  | { name: 'rom-bios-dumps' }
  | { name: 'mystery-gifts' }
  | { name: 'poke-transporter' }
  | { name: 'settings'; tab?: SettingsTab }
  | { name: 'news' }

/** Research Tools screens share one GB-Link session between their tasks. */
const RESEARCH_SCREENS: ReadonlySet<Screen['name']> = new Set([
  'research',
  'cartridge-saves',
  'rom-bios-dumps',
  'mystery-gifts',
  'poke-transporter',
])

/**
 * The Lab Zone: Pokédex Collections, the Trade Table, and Research Tools.
 * Storage is site-wide, so the Trade Table and Settings work on the
 * same saves and Camp Sites as the Camp Zone.
 */
export function LabMain({
  onBack,
  onOpenInCamp,
  campReturns,
  hidden = false,
}: {
  onBack: () => void
  /**
   * Leaves for a Camp Zone screen (a Pokédex entry's Cabin or Camp Site).
   * The Lab is kept mounted and hidden meanwhile, so Back returns here.
   */
  onOpenInCamp: (destination: CampDestination) => void
  /** Bumped each time the player comes back from the Camp Zone. */
  campReturns: number
  hidden?: boolean
}) {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  const { provider } = useStorageProvider()
  const toMenu = () => setScreen({ name: 'menu' })
  const inResearch = RESEARCH_SCREENS.has(screen.name)

  // Tasks release the GB-Link as they finish; this also covers leaving midway.
  useEffect(() => {
    if (!inResearch) return
    return () => {
      void gbLinkTradeDevice.disconnect().catch(() => {})
    }
  }, [inResearch])

  return (
    <NavigationScopeProvider value={!hidden}>
      <div className="camp-zone lab-zone" hidden={hidden}>
        <SourceLink />
        <DropboxBadge
          onOpen={() => {
            setScreen({ name: 'settings', tab: 'storage' })
          }}
        />
        {renderScreen()}
      </div>
    </NavigationScopeProvider>
  )

  function renderScreen() {
    switch (screen.name) {
      case 'collections':
        return (
          <CollectionView
            onBack={toMenu}
            onOpenInCamp={onOpenInCamp}
            campReturns={campReturns}
          />
        )
      case 'trade':
        return <LabTradeTable onBack={toMenu} />
      case 'research':
        return (
          <ResearchTools
            onBack={toMenu}
            onOpenSaves={() => setScreen({ name: 'cartridge-saves' })}
            onOpenDumps={() => setScreen({ name: 'rom-bios-dumps' })}
            onOpenGifts={() => setScreen({ name: 'mystery-gifts' })}
            onOpenTransporter={() => setScreen({ name: 'poke-transporter' })}
          />
        )
      case 'cartridge-saves':
        return <CartridgeSaves onBack={() => setScreen({ name: 'research' })} />
      case 'rom-bios-dumps':
        return <RomBiosDumps onBack={() => setScreen({ name: 'research' })} />
      case 'mystery-gifts':
        return <MysteryGifts onBack={() => setScreen({ name: 'research' })} />
      case 'poke-transporter':
        return (
          <PokeTransporter onBack={() => setScreen({ name: 'research' })} />
        )
      case 'settings':
        return (
          <LabSettings
            key={`${screen.tab ?? 'backups'}:${provider.id}`}
            initialTab={screen.tab}
            onBack={toMenu}
          />
        )
      case 'news':
        return (
          <div className="camp-root">
            <div className="camp-content">
              <header className="camp-page-header">
                <button type="button" className="camp-back" onClick={toMenu}>
                  ← Back
                </button>
                <div className="camp-page-heading">
                  <p className="camp-eyebrow">Lab Zone</p>
                  <h1 className="camp-title">Patch Notes</h1>
                </div>
                <span className="camp-page-header-spacer" aria-hidden="true" />
              </header>
              <NewsPage />
            </div>
          </div>
        )
      case 'menu':
        return (
          <LabMenu
            onBack={onBack}
            onSelectCollections={() => setScreen({ name: 'collections' })}
            onSelectTrade={() => setScreen({ name: 'trade' })}
            onSelectResearch={() => setScreen({ name: 'research' })}
            onSelectSettings={() => setScreen({ name: 'settings' })}
            onSelectNews={() => setScreen({ name: 'news' })}
          />
        )
    }
  }
}
