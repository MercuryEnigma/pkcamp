import { afterEach, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import natureData from '../../../vendor/pkhex-wasm/src/ts/gen/data/natures.json'
import { PokemonDetails } from '../../pages/pokestorage/PokemonDetails'
import { makeNode } from '../../pages/pokestorage/lab/testHelpers'
import { natureStatEffect } from '../pkhex'
import { initializeSpriteResolver } from '../sprites'
import { i18n } from './index'
import { natureName } from './pokemonTerms'

// PKHeX's Spanish text_Natures_es.txt, in nature-ID order.
const spanishNames = [
  'Fuerte',
  'Huraña',
  'Audaz',
  'Firme',
  'Pícara',
  'Osada',
  'Dócil',
  'Plácida',
  'Agitada',
  'Floja',
  'Miedosa',
  'Activa',
  'Seria',
  'Alegre',
  'Ingenua',
  'Modesta',
  'Afable',
  'Mansa',
  'Tímida',
  'Alocada',
  'Serena',
  'Amable',
  'Grosera',
  'Cauta',
  'Rara',
]

afterEach(async () => {
  await i18n.changeLanguage('en')
})

it('displays all 25 Spanish nature names and resolves them again after a language change', async () => {
  await i18n.changeLanguage('es')
  expect(natureData.map(natureName)).toEqual(spanishNames)
  await i18n.changeLanguage('en')
  expect(natureData.map(natureName)).toEqual(
    natureData.map((nature) => nature.name)
  )
})

it('renders the translated nature in Camp without changing Pokémon data or stat effects', async () => {
  const nature = { id: 20, name: 'Calm' }
  const pokemon = makeNode({ nature })
  const original = JSON.stringify(pokemon)
  await i18n.changeLanguage('es')
  const html = renderToStaticMarkup(
    <PokemonDetails
      pokemon={pokemon}
      resolver={initializeSpriteResolver({ sourceId: 'test', manifest: [] })}
      view="movesTraits"
    />
  )
  expect(html).toContain('Naturaleza')
  expect(html).toContain('Serena')
  expect(html).not.toContain('Calm')
  expect(pokemon.nature).toBe(nature)
  expect(JSON.stringify(pokemon)).toBe(original)
  expect(natureStatEffect(pokemon.nature, 'attack')).toBe('-')
  expect(natureStatEffect(pokemon.nature, 'specialDefense')).toBe('+')
})

it('preserves missing and unrecognized nature values', async () => {
  await i18n.changeLanguage('es')
  expect(natureName(null)).toBeNull()
  expect(natureName({ id: 99, name: 'Custom nature' })).toBe('Custom nature')
  expect(natureName({ id: 0, name: 'Custom nature' })).toBe('Custom nature')
})
