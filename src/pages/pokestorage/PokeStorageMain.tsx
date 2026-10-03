import { useState } from 'react'
import type { Gen3GameId } from '../../services/saveLibrary'
import { CampActivities } from './CampActivities'
import './camp.css'
import { GameSelect } from './GameSelect'
import { GenerationSelect } from './GenerationSelect'
import { LocalPokemonView } from './LocalPokemonView'
import { PokeStorageSettings } from './PokeStorageSettings'
import { SaveViewer } from './SaveViewer'
import { Splash } from './Splash'
import { TradeView } from './TradeView'

/**
 * The Camp Zone -> onwards flow: activity list -> lodge select -> the GBA
 * Lodge's Cabin directory -> the actual save viewer. This component is
 * the entry point rendered by (read-only, outside this directory's scope)
 * PokeStorage.tsx, so navigation from Camp Zone downward lives entirely here.
 */
type Screen =
  | { name: 'splash' }
  | { name: 'activities' }
  | { name: 'generationSelect' }
  | { name: 'gameSelect' }
  | { name: 'saveViewer'; gameId: Gen3GameId; initialBox?: number }
  | { name: 'localPokemon' }
  | { name: 'trade'; initialGameId?: Gen3GameId; initialBox?: number }
  | { name: 'settings' }

export function PokeStorageMain({
  onUnsavedChangesChange,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  const [screen, setScreen] = useState<Screen>({ name: 'splash' })

  switch (screen.name) {
    case 'splash':
      return <Splash onStart={() => setScreen({ name: 'activities' })} />
    case 'activities':
      return (
        <CampActivities
          onSelectLodges={() => setScreen({ name: 'generationSelect' })}
          onSelectTrade={() => setScreen({ name: 'trade' })}
          onSelectSettings={() => setScreen({ name: 'settings' })}
        />
      )
    case 'settings':
      return (
        <PokeStorageSettings onBack={() => setScreen({ name: 'activities' })} />
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
          onBack={() => setScreen({ name: 'gameSelect' })}
          onTrade={(box) =>
            setScreen({
              name: 'trade',
              initialGameId: screen.gameId,
              initialBox: box,
            })
          }
          onManageBackup={() => setScreen({ name: 'settings' })}
          onUnsavedChangesChange={onUnsavedChangesChange}
        />
      )
    case 'localPokemon':
      return (
        <LocalPokemonView
          onBack={() => setScreen({ name: 'gameSelect' })}
          onUnsavedChangesChange={onUnsavedChangesChange}
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
