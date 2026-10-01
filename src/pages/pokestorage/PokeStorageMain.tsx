import { useState } from 'react'
import type { Gen3GameId } from '../../services/saveLibrary'
import { CampActivities } from './CampActivities'
import './camp.css'
import { GameSelect } from './GameSelect'
import { GenerationSelect } from './GenerationSelect'
import { LocalPokemonView } from './LocalPokemonView'
import { PokeStorageSettings } from './PokeStorageSettings'
import { SaveViewer } from './SaveViewer'
import { TradePokemonView } from './TradePokemonView'
import { TradeSaveView } from './TradeSaveView'

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
  | { name: 'saveViewer'; gameId: Gen3GameId }
  | { name: 'localPokemon' }
  | { name: 'tradeGenerationSelect' }
  | { name: 'tradeGameSelect' }
  | { name: 'tradePokemon' }
  | { name: 'tradeSave'; gameId: Gen3GameId }
  | { name: 'settings' }

export function PokeStorageMain({
  onUnsavedChangesChange,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
}) {
  const [screen, setScreen] = useState<Screen>({ name: 'activities' })

  switch (screen.name) {
    case 'activities':
      return (
        <CampActivities
          onSelectLodges={() => setScreen({ name: 'generationSelect' })}
          onSelectTrade={() => setScreen({ name: 'tradeGenerationSelect' })}
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
          onBack={() => setScreen({ name: 'gameSelect' })}
          onTrade={() =>
            setScreen({ name: 'tradeSave', gameId: screen.gameId })
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
    case 'tradeGenerationSelect':
      return (
        <GenerationSelect
          activity="trade"
          onBack={() => setScreen({ name: 'activities' })}
          onSelectGeneration={() => setScreen({ name: 'tradeGameSelect' })}
        />
      )
    case 'tradeGameSelect':
      return (
        <GameSelect
          activity="trade"
          onBack={() => setScreen({ name: 'tradeGenerationSelect' })}
          onSelectGame={(gameId) => setScreen({ name: 'tradeSave', gameId })}
          onSelectLocalPokemon={() => setScreen({ name: 'tradePokemon' })}
        />
      )
    case 'tradePokemon':
      return (
        <TradePokemonView
          onBack={() => setScreen({ name: 'tradeGameSelect' })}
        />
      )
    case 'tradeSave':
      return (
        <TradeSaveView
          gameId={screen.gameId}
          onBack={() => setScreen({ name: 'tradeGameSelect' })}
          onReturnToLodge={() =>
            setScreen({ name: 'saveViewer', gameId: screen.gameId })
          }
          onManageBackup={() => setScreen({ name: 'settings' })}
        />
      )
  }
}
