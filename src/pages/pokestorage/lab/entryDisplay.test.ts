import { describe, expect, it } from 'vitest'
import type { CollectionDefinition } from './collectionTypes'
import {
  collectionEntryLabel,
  describeRequirements,
  entryLabel,
  requirementFields,
} from './entryDisplay'

describe('Pokédex requirement display', () => {
  it('renders only actual constraints, preserving alternatives and all-of requirements', () => {
    expect(
      describeRequirements({
        species: 25,
        shiny: [true, false],
        all_moves: [33, 45],
        ot: 'Researcher',
      })
    ).toEqual([
      'Species: #25 Pikachu',
      'Shiny: Yes or No',
      'Knows all of: 33, 45',
      'Original trainer: Researcher',
    ])
    expect(describeRequirements({})).toEqual([])
  })
  it('identifies explicit default forms and distinct Unown entries', () => {
    expect(describeRequirements({ species: 25, form: 0 })).toContain(
      'Form: Default'
    )
    expect(entryLabel('unown-a', { species: 201, form: 0 })).toBe('Unown A')
    expect(entryLabel('unown-question', { species: 201, form: 27 })).toBe(
      'Unown ?'
    )
  })
})

it('distinguishes same-species constrained entries without changing ordinary species names', () => {
  const definition: CollectionDefinition = {
    schemaVersion: '1',
    id: 'events',
    name: 'Events',
    metadata: { version: '1' },
    groups: [],
    pokemon: {
      'event-pikachu': { species: 25, ot: 'EVENT' },
      'shiny-pikachu': { species: 25, shiny: true },
      bulbasaur: { species: 1 },
    },
  }
  expect(collectionEntryLabel(definition, 'event-pikachu')).toBe(
    'Pikachu · event-pikachu'
  )
  expect(collectionEntryLabel(definition, 'shiny-pikachu')).toBe(
    'Pikachu · shiny-pikachu'
  )
  expect(collectionEntryLabel(definition, 'bulbasaur')).toBe('Bulbasaur')
})

describe('Pokédex requirement record', () => {
  it('lists only constrained fields as label/value pairs', () => {
    expect(
      requirementFields({ species: 14, isEgg: false, moves: [33, 45] })
    ).toEqual([
      { label: 'Species', value: 'Kakuna', values: ['Kakuna'] },
      { label: 'Egg', value: 'No', values: ['No'] },
      { label: 'Move', value: 'Any of 33, 45', values: ['33', '45'] },
    ])
    expect(requirementFields({ species: 201, form: 27 })).toEqual([
      { label: 'Species', value: 'Unown', values: ['Unown'] },
      { label: 'Form', value: '?', values: ['?'] },
    ])
    expect(requirementFields({})).toEqual([])
  })
})
