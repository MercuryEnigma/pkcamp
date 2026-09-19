import { useState } from 'react'
import { Options } from './Options'
import { PokeStorage } from './PokeStorage'

export function Campsite() {
  const [active, setActive] = useState<
    'start' | 'campsite' | 'options' | 'pokemon'
  >('start')
  return (
    <>
      {active === 'start' && (
        <div>
          <button onClick={() => setActive('campsite')}>Start</button>
        </div>
      )}
      {active == 'campsite' && (
        <div>
          <button onClick={() => setActive('pokemon')}>Pokemon Storage</button>
          <button onClick={() => setActive('options')}>Options</button>
        </div>
      )}
      {active == 'pokemon' && (
        <>
          <PokeStorage />
          <button onClick={() => setActive('campsite')}>Back</button>
        </>
      )}
      {active == 'options' && (
        <>
          <Options />
          <button onClick={() => setActive('campsite')}>Back</button>
        </>
      )}
    </>
  )
}
