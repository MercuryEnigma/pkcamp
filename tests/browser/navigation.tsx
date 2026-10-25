import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { NavigationProvider } from '../../src/pages/context/NavigationProvider'
import { PkHexContext } from '../../src/pages/context/PkHexContext'
import {
  useNavigationGuard,
  useConfirmNavigation,
  NavigationScopeProvider,
} from '../../src/pages/pokestorage/navigationGuard'
import { CampPage } from '../../src/pages/pokestorage/camp/CampPage'
import { activeGame } from '../../src/services/activeGame'
import { DropboxBadge } from '../../src/pages/pokestorage/DropboxBadge'
import { useSpriteResolver } from '../../src/pages/pokestorage/useStorage'
import { storage } from '../../src/services/storage'
import { dropboxAccount } from '../../src/services/storage/dropbox'
import {
  createMockPokemonSaveBackend,
  initializePokemonSaveAdapter,
} from '../../src/services/pkhex'
import { SPRITE_SOURCES } from '../../src/services/sprites/catalog'

// No real cloud or hardware connections are used by these UI checks.
dropboxAccount.isConfigured = () => true
const adapter = initializePokemonSaveAdapter({
  backend: createMockPokemonSaveBackend(),
})

export function Blocker({
  active,
  message,
}: {
  active: boolean
  message: string
}) {
  useNavigationGuard(active, message)
  return null
}
export function SpriteConsumer({ id }: { id: string }) {
  const resolver = useSpriteResolver()
  return <output data-testid={id}>{resolver.sourceId}</output>
}
export function Harness() {
  const [mode, setMode] = useState('idle')
  const [opened, setOpened] = useState(0)
  const [saveReady, setSaveReady] = useState(false)
  const confirmLeave = useConfirmNavigation()
  const uploadDraft = async (file: File) => {
    await activeGame.select('emerald', storage, adapter)
    await activeGame.replaceSave(new Uint8Array(await file.arrayBuffer()))
    activeGame.movePokemon({ box: 0, slot: 0 }, { box: 0, slot: 1 })
    setSaveReady(true)
  }
  return (
    <>
      <button onClick={() => setMode('dirty')}>Dirty editor</button>
      <button onClick={() => setMode('trade')}>Active trade</button>
      <button onClick={() => setMode('hidden')}>Hidden Lab</button>
      <button onClick={() => setMode('idle')}>Idle</button>
      <button onClick={() => setMode('save')}>Save viewer</button>
      <Blocker active={mode === 'dirty'} message="Unsaved edits" />
      <Blocker active={mode === 'trade'} message="Active trade" />
      <NavigationScopeProvider value={false}>
        {mode === 'hidden' && <Blocker active message="Hidden Lab edits" />}
      </NavigationScopeProvider>
      <DropboxBadge onOpen={() => setOpened((value) => value + 1)} />
      <output data-testid="opened">{opened}</output>
      <SpriteConsumer id="sprite-a" />
      <SpriteConsumer id="sprite-b" />
      <button
        onClick={() =>
          void storage.saveSettings({ spriteSourceId: SPRITE_SOURCES[1].id })
        }
      >
        Change shared sprites
      </button>
      {mode === 'save' && (
        <section data-testid="draft-camp">
          <input
            type="file"
            accept=".sav"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void uploadDraft(file)
            }}
          />
          {saveReady && (
            <CampPage
              onBack={() => {
                if (confirmLeave()) setMode('idle')
              }}
            />
          )}
        </section>
      )}
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <PkHexContext.Provider value={{ adapter, loading: false, error: null }}>
    <NavigationProvider>
      <Harness />
    </NavigationProvider>
  </PkHexContext.Provider>
)
