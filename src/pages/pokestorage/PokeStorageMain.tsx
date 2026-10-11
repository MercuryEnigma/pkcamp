import { useCallback, useEffect, useRef, useState } from 'react'
import type { Gen3GameId } from '../../services/saveLibrary'
import { storage } from '../../services/storage'
import { dropboxAccount } from '../../services/storage/dropbox'
import { CampActivities } from './CampActivities'
import { DropboxBadge } from './DropboxBadge'
import './camp.css'
import { GameSelect } from './GameSelect'
import { GenerationSelect } from './GenerationSelect'
import { LocalPokemonView } from './LocalPokemonView'
import { PokeStorageSettings, type SettingsTab } from './PokeStorageSettings'
import { SaveViewer } from './SaveViewer'
import { Splash } from './Splash'
import { TradeView } from './TradeView'
import { useStorageProvider } from './useStorage'

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
  | { name: 'settings'; tab?: SettingsTab }

export function PokeStorageMain({
  onUnsavedChangesChange,
  onBack,
}: {
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void
  /** Leaves the Camp Zone; shows a Back button on the activity list. */
  onBack?: () => void
}) {
  const [screen, setScreen] = useState<Screen>({ name: 'splash' })
  const { provider } = useStorageProvider()

  // Idempotent: completes a Dropbox sign-in redirect or restores the session,
  // then warms the active storage's saves, Camps, and settings so screens
  // open without waiting on one download each. Repeats on provider changes.
  useEffect(() => {
    const prefetch = () =>
      storage.prefetch().catch((error: unknown) => {
        // Screens report storage errors themselves when they load.
        console.warn('Storage prefetch failed', error)
      })
    void dropboxAccount.initialize().then(prefetch)
    return storage.subscribe(() => void prefetch())
  }, [])

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
      case 'splash':
        return <Splash onStart={() => setScreen({ name: 'activities' })} />
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
            onBack={() => setScreen({ name: 'gameSelect' })}
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
            onBack={() => setScreen({ name: 'gameSelect' })}
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
