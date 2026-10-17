import { useState } from 'react'
import { StartMenu } from './hub/StartMenu'
import { WorldMap } from './hub/WorldMap'
import { useHubStartup } from './hub/useHubStartup'
import './pokestorage/camp.css'
import './hub/hub.css'
import { PokeStorageMain } from './pokestorage/PokeStorageMain'
import { LabMain } from './pokestorage/lab/LabMain'
import type { CampDestination } from './pokestorage/PokeStorageMain'

export function Campsite() {
  const startup = useHubStartup()
  const [active, setActive] = useState<
    'start' | 'campsite' | 'options' | 'pokemon'
  >('start')
  // A Lab entry opened its Cabin or Camp Site in the Camp Zone. The Lab stays
  // mounted (hidden) so Back returns to the same entry.
  const [fromLab, setFromLab] = useState<{
    id: number
    destination: CampDestination
  } | null>(null)
  const [labReturns, setLabReturns] = useState(0)

  const openInCamp = (destination: CampDestination) => {
    setFromLab((current) => ({ id: (current?.id ?? 0) + 1, destination }))
    setActive('pokemon')
  }
  const returnToLab = () => {
    setActive('options')
    setLabReturns((count) => count + 1)
  }

  return (
    <>
      {active === 'start' && (
        <StartMenu startup={startup} onStart={() => setActive('campsite')} />
      )}
      {active === 'campsite' && (
        <WorldMap
          onCamp={() => setActive('pokemon')}
          onLab={() => setActive('options')}
          onBack={() => setActive('start')}
        />
      )}
      {active == 'pokemon' && (
        <PokeStorageMain
          key={fromLab?.id ?? 'camp'}
          onBack={() => {
            setFromLab(null)
            setActive('campsite')
          }}
          destination={fromLab?.destination}
          onReturn={fromLab ? returnToLab : undefined}
        />
      )}
      {(active == 'options' || fromLab) && (
        <LabMain
          hidden={active !== 'options'}
          onBack={() => {
            setFromLab(null)
            setActive('campsite')
          }}
          onOpenInCamp={openInCamp}
          campReturns={labReturns}
        />
      )}
    </>
  )
}
