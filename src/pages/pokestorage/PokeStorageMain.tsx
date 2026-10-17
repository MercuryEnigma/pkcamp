import { useCallback, useRef, useState } from 'react'
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
 * The Camp Zone -> onwards flow: activity list -> lodge select -> the GBA
 * Lodge's Cabin directory -> the actual save viewer. This component is
 * the entry point rendered by (read-only, outside this directory's scope)
 * PokeStorage.tsx, so navigation from Camp Zone downward lives entirely here.
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
  onUnsavedChangesChange,
  onBack,
  destination,
  onReturn,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
  /** Leaves the Camp Zone; shows a Back button on the activity list. */
  onBack?: () => void
  /** Opens straight onto this screen instead of the splash. */
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

  // Screens guard their own navigation; the corner badge needs the same check.
  const unsavedRef = useRef(false)
  const handleUnsavedChange = useCallback(
    (hasUnsavedChanges: boolean) => {
      unsavedRef.current = hasUnsavedChanges
      onUnsavedChangesChange?.(hasUnsavedChanges)
    },
    [onUnsavedChangesChange]
  )

  const confirmLeave = () => {
    if (
      unsavedRef.current &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
      return false
    }
    handleUnsavedChange(false)
    return true
  }

  const openStorageSettings = () => {
    if (confirmLeave()) setScreen({ name: 'settings', tab: 'storage' })
  }

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
            onSelectLodges={() => setScreen({ name: 'generationSelect' })}
            onSelectTrade={() => setScreen({ name: 'trade' })}
            onSelectSettings={() => setScreen({ name: 'settings' })}
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
            onBack={() => setScreen({ name: 'generationSelect' })}
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
            onUnsavedChangesChange={handleUnsavedChange}
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
            onUnsavedChangesChange={handleUnsavedChange}
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
