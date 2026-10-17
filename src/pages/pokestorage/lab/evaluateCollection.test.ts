import { describe, expect, it } from 'vitest'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import type { CollectionDefinition, EntryConstraints } from './collectionTypes'
import { evaluateCollection, satisfies } from './evaluateCollection'
import { makeNode, scanned } from './testHelpers'

function definition(
  pokemon: Record<string, EntryConstraints>,
  groups: CollectionDefinition['groups'] = []
): CollectionDefinition {
  return {
    schemaVersion: '1',
    id: 'test',
    name: 'Test',
    metadata: { version: '1.0.0' },
    groups,
    pokemon,
  }
}

const matched = (
  constraints: EntryConstraints,
  overrides: Parameters<typeof makeNode>[0] = {}
) => satisfies(makeNode(overrides), constraints)

describe('scalar and array constraints', () => {
  it('a scalar is an exact match', () => {
    expect(matched({ species: 1 })).toBe(true)
    expect(matched({ species: 2 })).toBe(false)
    expect(matched({ shiny: true })).toBe(false)
    expect(matched({ nickname: 'MON' })).toBe(true)
  })

  it('an array means one of', () => {
    expect(matched({ species: [3, 1] })).toBe(true)
    expect(matched({ species: [3, 4] })).toBe(false)
    expect(matched({ gender: ['female', 'MALE'] })).toBe(true)
  })

  it('ANDs different fields together', () => {
    expect(matched({ species: 1, level: 10 })).toBe(true)
    expect(matched({ species: 1, level: 11 })).toBe(false)
    expect(matched({ species: 1, shiny: true })).toBe(false)
  })

  it('matches ids and names for item, ability, and nature', () => {
    const held = { heldItem: 13, heldItemName: 'Oran Berry' }
    expect(matched({ item: 13 }, held)).toBe(true)
    expect(matched({ item: 'oran berry' }, held)).toBe(true)
    expect(matched({ item: 14 }, held)).toBe(false)
    expect(matched({ ability: 'overgrow' })).toBe(true)
    expect(matched({ ability: 65 })).toBe(true)
    expect(matched({ nature: 'Hardy' })).toBe(true)
  })

  it('never matches a null ability or nature', () => {
    const none = { ability: null, nature: null }
    expect(matched({ ability: 65 }, none)).toBe(false)
    expect(matched({ ability: ['Overgrow', 0] }, none)).toBe(false)
    expect(matched({ nature: 0 }, none)).toBe(false)
    expect(matched({ nature: 'Hardy' }, none)).toBe(false)
  })

  it('matches the original trainer name and id', () => {
    expect(matched({ ot: 'RED', id: 1 })).toBe(true)
    expect(matched({ ot: 'BLUE' })).toBe(false)
  })
})

describe('moves and ribbons', () => {
  const moves = [
    { id: 33, name: 'Tackle', pp: 35 },
    { id: 45, name: 'Growl', pp: 40 },
    null,
    null,
  ]

  it('moves knows at least one listed move', () => {
    expect(matched({ moves: ['Growl', 'Surf'] }, { moves })).toBe(true)
    expect(matched({ moves: [33] }, { moves })).toBe(true)
    expect(matched({ moves: ['Surf', 'Fly'] }, { moves })).toBe(false)
  })

  it('all_moves knows every listed move', () => {
    expect(matched({ all_moves: ['tackle', 'GROWL'] }, { moves })).toBe(true)
    expect(matched({ all_moves: ['Tackle', 'Surf'] }, { moves })).toBe(false)
  })

  it('matches ribbons by name or short name', () => {
    const ribbons = [
      {
        id: 1,
        name: 'Champion (Gen3)',
        shortName: 'Champion',
        iconFile: 'x.png',
      },
      { id: 7, name: 'Effort', shortName: 'Effort', iconFile: 'y.png' },
    ]
    expect(matched({ ribbons: ['champion', 'Cool'] }, { ribbons })).toBe(true)
    expect(matched({ ribbons: 'Champion (Gen3)' }, { ribbons })).toBe(true)
    expect(matched({ ribbons: 'Cool' }, { ribbons })).toBe(false)
    expect(matched({ all_ribbons: ['Champion', 'Effort'] }, { ribbons })).toBe(
      true
    )
    expect(matched({ all_ribbons: ['Champion', 'Cool'] }, { ribbons })).toBe(
      false
    )
  })
})

describe('evaluateCollection', () => {
  it('keeps every match, and one Pokémon can satisfy several entries', () => {
    const def = definition({
      any: { species: 25 },
      shiny: { species: 25, shiny: true },
      other: { species: 26 },
    })
    const a = scanned({ species: 25, shiny: true })
    const b = scanned(
      { species: 25 },
      { gameId: 'ruby', location: { box: 1, slot: 2 }, boxName: 'BOX 2' }
    )
    const result = evaluateCollection(def, [a, b])
    expect(result.any.matches).toEqual([a, b])
    expect(result.shiny.matches).toEqual([a])
    expect(result.shiny.matched).toBe(true)
    expect(result.other).toEqual({
      entryId: 'other',
      matched: false,
      matches: [],
    })
  })

  it('counts an entry listed in two groups once', () => {
    const def = definition({ one: { species: 1 }, two: { species: 2 } }, [
      { id: 'a', name: 'A', pokemon: ['one', 'two'] },
      { id: 'b', name: 'B', pokemon: ['one'] },
    ])
    expect(Object.keys(evaluateCollection(def, []))).toEqual(['one', 'two'])
  })

  it('excludes eggs in the built-in collections', () => {
    const egg = scanned({ species: 201, form: 0, isEgg: true })
    const hatched = scanned({ species: 201, form: 0, isEgg: false })
    for (const def of BUILT_IN_COLLECTIONS) {
      const entryId = def.id === 'unown-dex' ? 'unown-a' : '0201'
      // No Unown entry in these.
      if (def.id === 'kanto-dex' || def.id === 'gen3-in-game-trades') continue
      expect(evaluateCollection(def, [egg])[entryId].matched).toBe(false)
      expect(evaluateCollection(def, [hatched])[entryId].matched).toBe(true)
    }
  })

  it('refuses constraints it cannot check', () => {
    const def = definition({
      bad: { teraType: 'Fire' } as unknown as EntryConstraints,
    })
    expect(() => evaluateCollection(def, [scanned()])).toThrow(/not supported/)
    expect(() =>
      evaluateCollection(definition({ empty: {} }), [scanned()])
    ).toThrow()
  })
})
