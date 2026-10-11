import { useState } from 'react'
import type { Gen3GameId } from '../../../services/saveLibrary'
import { SaveViewer } from '../SaveViewer'
import { TradeView } from '../TradeView'
import { PokeStorageSettings } from '../PokeStorageSettings'

/** Matching locations open the Cabin in the Camp Zone, with its Trading Post and Office. */
export function CabinDestination({
  gameId,
  box,
  onBack,
}: {
  gameId: Gen3GameId
  box?: number
  onBack: () => void
}) {
  const [screen, setScreen] = useState<'cabin' | 'trade' | 'settings'>('cabin')
  const [currentBox, setCurrentBox] = useState(box)
  if (screen === 'trade')
    return (
      <TradeView
        initialGameId={gameId}
        initialBox={currentBox}
        onBack={(nextBox) => {
          setCurrentBox(nextBox)
          setScreen('cabin')
        }}
      />
    )
  if (screen === 'settings')
    return <PokeStorageSettings onBack={() => setScreen('cabin')} />
  return (
    <SaveViewer
      gameId={gameId}
      initialBox={currentBox}
      onBack={onBack}
      onTrade={(nextBox) => {
        setCurrentBox(nextBox)
        setScreen('trade')
      }}
      onManageBackup={() => setScreen('settings')}
    />
  )
}
