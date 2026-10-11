import { useState } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import {
  NavigationGuardProvider,
  useNavigationGuards,
} from '../navigationGuard'
import { NewsPage } from '../../NewsPage'
import '../camp.css'
import { DropboxBadge } from '../DropboxBadge'
import { useStorageProvider } from '../useStorage'
import { CabinDestination } from './CabinDestination'
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
export function LabMain({ onBack }: { onBack: () => void }) {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' })
  const { provider } = useStorageProvider()
  const { register, confirmLeave } = useNavigationGuards()
  const toMenu = () => setScreen({ name: 'menu' })
  // "Go To Cabin" leaves the Lab for the Camp Zone's Cabin. The Lab stays
  // mounted (hidden) so Back returns to the same Pokédex entry.
  const [cabin, setCabin] = useState<{
    gameId: Gen3GameId
    box?: number
  } | null>(null)
  const [cabinReturns, setCabinReturns] = useState(0)

  return (
    <NavigationGuardProvider value={register}>
      {cabin && (
        <div className="camp-zone">
          <CabinDestination
            {...cabin}
            onBack={() => {
              setCabin(null)
              setCabinReturns((count) => count + 1)
            }}
          />
        </div>
      )}
      <div className="camp-zone lab-zone" hidden={cabin !== null}>
        <DropboxBadge
          onOpen={() => {
            if (confirmLeave()) setScreen({ name: 'settings', tab: 'storage' })
          }}
        />
        {renderScreen()}
      </div>
    </NavigationGuardProvider>
  )

  function renderScreen() {
    switch (screen.name) {
      case 'collections':
        return (
          <CollectionView
            onBack={toMenu}
            onOpenCabin={(gameId, box) => setCabin({ gameId, box })}
            cabinReturns={cabinReturns}
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
