import { useState } from 'react'
import { useConfirmNavigation } from './navigationGuard'
import type { Gen3GameId } from '../../services/saveLibrary'
import { CampActivities } from './CampActivities'
import { DropboxBadge } from './DropboxBadge'
import './camp.css'
import { GameSelect } from './GameSelect'
import { GenerationSelect } from './GenerationSelect'
import { LocalPokemonView } from './LocalPokemonView'
import { PokeStorageSettings, type SettingsTab } from './PokeStorageSettings'
import { SaveViewer } from './SaveViewer'
import { TradeView } from './TradeView'
import { useStorageProvider } from './useStorage'

/**
 * The Camp Zone flow: activity list -> the GBA
 * Lodge's Cabin directory -> the actual save viewer. This component is
 * the Camp entry point rendered by Campsite; navigation below the zone
 * lives here.
 */
type Screen =
  | { name: 'activities' }
  | { name: 'generationSelect' }
  | { name: 'gameSelect' }
  | { name: 'saveViewer'; gameId: Gen3GameId; initialBox?: number }
  | { name: 'localPokemon'; initialSite?: number }
  | { name: 'trade'; initialGameId?: Gen3GameId; initialBox?: number }
  | { name: 'settings'; tab?: SettingsTab }

/**
 * A Camp screen another zone can open directly, e.g. the Lab showing where a
 * Pokédex entry was found.
 */
export type CampDestination =
  | { name: 'cabin'; gameId: Gen3GameId; box?: number }
  | { name: 'campSites'; site?: number }

function destinationScreen(destination: CampDestination): Screen {
  return destination.name === 'cabin'
    ? {
        name: 'saveViewer',
        gameId: destination.gameId,
        initialBox: destination.box,
      }
    : { name: 'localPokemon', initialSite: destination.site }
}

export function PokeStorageMain({
  onBack,
  destination,
  onReturn,
}: {
  /** Leaves the Camp Zone; shows a Back button on the activity list. */
  onBack?: () => void
  /** Opens straight onto this screen instead of the activity menu. */
  destination?: CampDestination
  /**
   * Back from the `destination` screen goes here (e.g. back to the Lab)
   * instead of up to the Cabin directory.
   */
  onReturn?: () => void
}) {
  const [screen, setScreen] = useState<Screen>(() =>
    destination ? destinationScreen(destination) : { name: 'activities' }
  )
  const { provider } = useStorageProvider()

  const confirmLeave = useConfirmNavigation()
  const openStorageSettings = () =>
    setScreen({ name: 'settings', tab: 'storage' })
  const leaveCamp = onBack && (() => confirmLeave() && onBack())

  return (
    <div className="camp-zone">
      <DropboxBadge onOpen={openStorageSettings} />
      {renderScreen()}
    </div>
  )

  function renderScreen() {
    switch (screen.name) {
      case 'activities':
        return (
          <CampActivities
            onBack={leaveCamp}
            onSelectLodges={() => setScreen({ name: 'gameSelect' })}
            onSelectTrade={() => setScreen({ name: 'trade' })}
          />
        )
      case 'settings':
        return (
          <PokeStorageSettings
            key={`${screen.tab ?? 'backups'}:${provider.id}`}
            initialTab={screen.tab}
            onBack={() => setScreen({ name: 'activities' })}
          />
        )
      case 'generationSelect':
        return (
          <GenerationSelect
            onBack={() => setScreen({ name: 'activities' })}
            onSelectGeneration={() => setScreen({ name: 'gameSelect' })}
          />
        )
      case 'gameSelect':
        return (
          <GameSelect
            onBack={() => setScreen({ name: 'activities' })}
            onSelectGame={(gameId) => setScreen({ name: 'saveViewer', gameId })}
            onSelectLocalPokemon={() => setScreen({ name: 'localPokemon' })}
          />
        )
      case 'saveViewer':
        return (
          <SaveViewer
            gameId={screen.gameId}
            initialBox={screen.initialBox}
            onBack={() =>
              onReturn &&
              destination?.name === 'cabin' &&
              destination.gameId === screen.gameId
                ? onReturn()
                : setScreen({ name: 'gameSelect' })
            }
            onTrade={(box) =>
              setScreen({
                name: 'trade',
                initialGameId: screen.gameId,
                initialBox: box,
              })
            }
            onManageBackup={() => setScreen({ name: 'settings' })}
          />
        )
      case 'localPokemon':
        return (
          <LocalPokemonView
            initialSite={screen.initialSite}
            onBack={() =>
              onReturn && destination?.name === 'campSites'
                ? onReturn()
                : setScreen({ name: 'gameSelect' })
            }
          />
        )
      case 'trade':
        return (
          <TradeView
            initialGameId={screen.initialGameId}
            initialBox={screen.initialBox}
            onBack={(box) =>
              screen.initialGameId
                ? setScreen({
                    name: 'saveViewer',
                    gameId: screen.initialGameId,
                    initialBox: box,
                  })
                : setScreen({ name: 'activities' })
            }
          />
        )
    }
  }
}
