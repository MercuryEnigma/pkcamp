import { describe, expect, it } from 'vitest'
import {
  SPECIES_OPTIONS,
  draftProblems,
  emptyDraft,
  entryIdFor,
  slugify,
  toDefinition,
  type CollectionDraft,
  type DraftEntry,
} from './builderDraft'

const option = (label: string) =>
  SPECIES_OPTIONS.find((item) => item.label === label)!

function entry(label: string, change: Partial<DraftEntry> = {}): DraftEntry {
  const species = option(label)
  return {
    id: species.slug,
    species,
    shiny: 'any',
    ribbons: [],
    nature: '',
    ability: '',
    move: '',
    ot: '',
    trainerId: '',
    ...change,
  }
}

function draft(): CollectionDraft {
  return {
    ...emptyDraft(new Date('2026-10-24T12:00:00Z')),
    name: 'My Favorites!',
    entries: [
      entry('Venusaur', {
        shiny: 'yes',
        ribbons: ['Champion (Gen3)', 'Effort'],
        nature: 'Adamant',
        move: '76',
        ot: 'Chase',
        trainerId: '12345',
      }),
      entry('Unown A'),
      entry('Unown (any)'),
    ],
  }
}

describe('SPECIES_OPTIONS', () => {
  it('lists every species, with each Unown form and any Unown', () => {
    expect(option('Bulbasaur')).toMatchObject({ species: 1, form: null })
    expect(option('Unown (any)')).toMatchObject({ species: 201, form: null })
    expect(option('Unown ?')).toMatchObject({
      form: 27,
      slug: 'unown-question',
    })
    expect(SPECIES_OPTIONS).toHaveLength(386 + 28)
  })
})

describe('toDefinition', () => {
  it('writes one group and each entry’s constraints', () => {
    const definition = toDefinition(draft())
    expect(definition.id).toBe('my-favorites')
    expect(definition.metadata).toEqual({
      version: '1.0.0',
      updated: '2026-10-24',
    })
    expect(definition.groups).toEqual([
      {
        id: 'all',
        name: 'My Favorites!',
        pokemon: ['venusaur', 'unown-a', 'unown-any'],
      },
    ])
    expect(definition.pokemon.venusaur).toEqual({
      species: 3,
      isEgg: false,
      shiny: true,
      all_ribbons: ['Champion (Gen3)', 'Effort'],
      nature: 'Adamant',
      moves: 76,
      ot: 'Chase',
      id: 12345,
    })
    expect(definition.pokemon['unown-a']).toEqual({
      species: 201,
      isEgg: false,
      form: 0,
    })
    expect(definition.pokemon['unown-any']).toEqual({
      species: 201,
      isEgg: false,
    })
  })
})

describe('draftProblems', () => {
  it('accepts a complete draft', () => {
    expect(draftProblems(draft())).toEqual([])
  })

  it('asks for a name and a Pokémon', () => {
    expect(draftProblems(emptyDraft())).toHaveLength(2)
  })

  it('rejects a name with no letters or digits', () => {
    expect(draftProblems({ ...draft(), name: '!!!' })).toHaveLength(1)
  })
})

describe('entry ids', () => {
  it('slugifies names', () => {
    expect(slugify('  Gen 3: Living Dex!  ')).toBe('gen-3-living-dex')
  })

  it('numbers a repeated species', () => {
    expect(entryIdFor(option('Venusaur'), draft().entries)).toBe('venusaur-2')
    expect(entryIdFor(option('Ivysaur'), draft().entries)).toBe('ivysaur')
  })
})
