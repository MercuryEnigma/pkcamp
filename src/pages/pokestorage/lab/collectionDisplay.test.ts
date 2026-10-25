import { afterEach, expect, it } from 'vitest'
import { i18n } from '../../../services/i18n'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import { collectionDisplay } from './collectionDisplay'
import { entryMatchesFilter } from './entryFilter'

afterEach(async () => {
  await i18n.changeLanguage('en')
  i18n.removeResourceBundle('de', 'collections')
})

it('localizes built-in display copy without changing definitions or persisted constraints', async () => {
  const definition = BUILT_IN_COLLECTIONS.find(
    (item) => item.id === 'gen3-living-dex'
  )!
  const original = JSON.stringify(definition)
  i18n.addResource(
    'de',
    'collections',
    'builtIn.gen3-living-dex.name',
    'Gen 3 Sammlung'
  )
  i18n.addResource(
    'de',
    'collections',
    'builtIn.gen3-living-dex.groups.kanto.name',
    'Kanto Gruppe'
  )
  await i18n.changeLanguage('de')
  const display = collectionDisplay(definition)
  expect(display.name).toBe('Gen 3 Sammlung')
  expect(display.groups[0].name).toBe('Kanto Gruppe')
  expect(display.metadata.description).toBe(definition.metadata.description)
  expect(display.id).toBe(definition.id)
  expect(display.pokemon).toBe(definition.pokemon)
  expect(JSON.stringify(definition)).toBe(original)
})

it('preserves uploaded text, even when a supplied object uses a built-in id', async () => {
  const uploaded = structuredClone(BUILT_IN_COLLECTIONS[0])
  uploaded.name = 'My collection'
  i18n.addResource(
    'de',
    'collections',
    'builtIn.gen3-in-game-trades.name',
    'Tauschsammlung'
  )
  await i18n.changeLanguage('de')
  expect(collectionDisplay(uploaded)).toBe(uploaded)
  expect(collectionDisplay(uploaded).name).toBe('My collection')
})

it('keeps requirement matching independent of translated labels', async () => {
  i18n.addResource('de', 'collections', 'entryDisplay.move', 'Attacke')
  i18n.addResource(
    'de',
    'collections',
    'entryFilter.move',
    'Andere Beschriftung'
  )
  await i18n.changeLanguage('de')
  expect(
    entryMatchesFilter(
      { field: 'move', text: 'Surf' },
      {
        label: 'Pikachu',
        species: 25,
        constraints: { species: 25, moves: 'Surf' },
        matches: [],
      }
    )
  ).toBe(true)
})
