import { describe, expect, it } from 'vitest'
import { BUILT_IN_COLLECTIONS } from './builtInCollections'
import { validateCollection } from './validateCollection'

const byId = (id: string) => BUILT_IN_COLLECTIONS.find((c) => c.id === id)!

describe('built-in collections', () => {
  it('has the expected entry counts', () => {
    expect(Object.keys(byId('gen3-living-dex').pokemon)).toHaveLength(386)
    expect(Object.keys(byId('kanto-dex').pokemon)).toHaveLength(151)
    expect(Object.keys(byId('unown-dex').pokemon)).toHaveLength(28)
    expect(Object.keys(byId('gen3-in-game-trades').pokemon)).toHaveLength(18)
  })

  it('all validate and exclude eggs', () => {
    for (const def of BUILT_IN_COLLECTIONS) {
      expect(validateCollection(def).ok).toBe(true)
      for (const entry of Object.values(def.pokemon)) {
        expect(entry.isEgg).toBe(false)
      }
    }
  })

  it('groups the Living Dex by region', () => {
    const groups = byId('gen3-living-dex').groups
    expect(groups.map((g) => [g.id, g.pokemon.length])).toEqual([
      ['kanto', 151],
      ['johto', 100],
      ['hoenn', 135],
    ])
  })

  it('orders Unown A-Z, !, ? as forms 0-27', () => {
    const unown = byId('unown-dex')
    const ids = unown.groups[0].pokemon
    expect(ids[0]).toBe('unown-a')
    expect(ids[25]).toBe('unown-z')
    expect(ids[26]).toBe('unown-exclamation')
    expect(ids[27]).toBe('unown-question')
    ids.forEach((id, form) => {
      expect(unown.pokemon[id]).toEqual({ species: 201, form, isEgg: false })
    })
  })

  it('matches in-game trades by species, OT, and TID', () => {
    const makuhita = byId('gen3-in-game-trades').pokemon['rs-makuhita']
    expect(makuhita).toMatchObject({ species: 296, id: 49562 })
    expect(makuhita.ot).toContain('ELYSSA')
  })
})
