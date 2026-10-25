import { describe, expect, it } from 'vitest'
import type { StoredCollectionMatch } from '../../../services/storage'
import { entryMatchesFilter } from './entryFilter'

const match = {
  gameId: 'firered',
  location: 'party',
  species: 3,
  form: 0,
  nickname: 'Holland',
  originalTrainerName: 'Chase',
  originalTrainerId: 1,
  level: 52,
  shiny: false,
  moves: ['Solar Beam', 'Sleep Powder'],
  ability: 'Overgrow',
  heldItem: 'Leftovers',
  ribbons: ['Champion'],
} as StoredCollectionMatch

const entry = {
  label: 'Venusaur',
  species: 3,
  constraints: { species: 3 },
  matches: [match],
}

describe('entryMatchesFilter', () => {
  it('matches the name, case-insensitively', () => {
    expect(entryMatchesFilter({ field: 'name', text: 'VENU' }, entry)).toBe(
      true
    )
    expect(entryMatchesFilter({ field: 'name', text: 'holl' }, entry)).toBe(
      true
    )
    expect(entryMatchesFilter({ field: 'name', text: 'char' }, entry)).toBe(
      false
    )
  })

  it('matches the species type even when nothing is found', () => {
    const missing = { ...entry, matches: [] }
    expect(entryMatchesFilter({ field: 'type', text: 'poison' }, missing)).toBe(
      true
    )
    expect(entryMatchesFilter({ field: 'type', text: 'fire' }, missing)).toBe(
      false
    )
  })

  it('matches the found Pokémon’s moves, ability, item, ribbons and OT', () => {
    const yes = (
      field: 'move' | 'ability' | 'nature' | 'item' | 'ribbon' | 'ot',
      text: string
    ) => entryMatchesFilter({ field, text }, entry)
    expect(yes('move', 'solar')).toBe(true)
    expect(yes('ability', 'overgrow')).toBe(true)
    expect(yes('item', 'left')).toBe(true)
    expect(yes('ribbon', 'champ')).toBe(true)
    expect(yes('ot', 'chase')).toBe(true)
    expect(yes('move', 'surf')).toBe(false)
    expect(yes('nature', 'adamant')).toBe(false)
  })

  it('matches what the entry itself requires', () => {
    const required = {
      ...entry,
      matches: [],
      constraints: { species: 3, moves: 'Surf' },
    }
    expect(entryMatchesFilter({ field: 'move', text: 'surf' }, required)).toBe(
      true
    )
  })
})
