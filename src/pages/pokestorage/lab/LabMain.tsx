import { useState } from 'react'
import { NavigationScopeProvider } from '../navigationGuard'
import { NewsPage } from '../../NewsPage'
import '../camp.css'
import { DropboxBadge } from '../DropboxBadge'
import type { CampDestination } from '../PokeStorageMain'
import { useStorageProvider } from '../useStorage'
import { CollectionView } from './CollectionView'
import './lab.css'
import { LabMenu } from './LabMenu'
import { LabSettings, type SettingsTab } from './LabSettings'
import { LabTradeTable } from './LabTradeTable'
import './labZone.css'

type Screen =
  | { name: 'menu' }
  | { name: 'collections' }
  | { name: 'trade' }
  | { name: 'settings'; tab?: SettingsTab }
  | { name: 'news' }

/**
 * The Lab Zone: Pokédex Collections, the Trade Table, and (later) Research
 * Tools. Storage is site-wide, so the Trade Table and Settings work on the
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

  return (
    <NavigationScopeProvider value={!hidden}>
      <div className="camp-zone lab-zone" hidden={hidden}>
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
            onSelectSettings={() => setScreen({ name: 'settings' })}
            onSelectNews={() => setScreen({ name: 'news' })}
          />
        )
    }
  }
}
