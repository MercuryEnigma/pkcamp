import { useState } from 'react'
import { PokeStorage } from './PokeStorage'
import { LabMain } from './pokestorage/lab/LabMain'

export function Campsite() {
  const [active, setActive] = useState<
    'start' | 'campsite' | 'options' | 'pokemon'
  >('start')
  const [pokemonHasUnsavedChanges, setPokemonHasUnsavedChanges] =
    useState(false)

  const leavePokemonStorage = () => {
    if (
      pokemonHasUnsavedChanges &&
      !window.confirm('You have unsaved changes. Leave without saving them?')
    ) {
      return
    }
    setPokemonHasUnsavedChanges(false)
    setActive('campsite')
  }
  return (
    <>
      {active === 'start' && (
        <div>
          <button onClick={() => setActive('campsite')}>Start</button>
        </div>
      )}
      {active == 'campsite' && (
        <div>
          <p>
            <button onClick={() => setActive('pokemon')}>
              Camp Zone: Manage your Pokemon
            </button>
            <p></p>
            <button onClick={() => setActive('options')}>
              Lab Zone: Pokédex Collections &amp; research
            </button>
          </p>
          <p>Coming Soon: Battle Zone</p>
          <p>Coming Soon: Safari Zone</p>
          <p>Coming Soon: Pelago Zone</p>
          <p>Coming Soon: Arcade Zone</p>
        </div>
      )}
      {active == 'pokemon' && (
        <>
          <PokeStorage
            onUnsavedChangesChange={setPokemonHasUnsavedChanges}
            onBack={() => setActive('campsite')}
          />
          <button onClick={leavePokemonStorage}>Back</button>
        </>
      )}
      {active == 'options' && (
        <>
          <LabMain onBack={() => setActive('campsite')} />
        </>
      )}
    </>
  )
}
