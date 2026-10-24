import { describe, expect, it } from 'vitest'

import { initializePokemonSaveAdapter } from './adapter.ts'
import {
  createMockPokemonSaveBackend,
  encodeFixtureSaveBytes,
  encodePokemonFileBytes,
} from './mockBackend.ts'
import type { PokemonNode } from './types.ts'

function makeAdapter() {
  return initializePokemonSaveAdapter({
    backend: createMockPokemonSaveBackend(),
  })
}

describe('initializePokemonSaveAdapter', () => {
  it('loads a save into trainer/party/box shapes, preserving empty slots positionally', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))

    expect(save.trainer).toEqual({ name: 'MAY', id: 12345, secretId: 54321 })

    // Party has a fixed length and empty slots are real `null` entries, not omitted.
    expect(save.party).toHaveLength(6)
    expect(save.party[0]?.species).toBe(25)
    expect(save.party.slice(1)).toEqual([null, null, null, null, null])

    // Box preserves empty slots between occupied ones (index 1 is empty, between 0 and 2).
    expect(save.boxes[0].slots).toHaveLength(30)
    expect(save.boxes[0].slots[0]?.species).toBe(133)
    expect(save.boxes[0].slots[1]).toBeNull()
    expect(save.boxes[0].slots[2]?.isEgg).toBe(true)

    save.dispose()
  })

  it('reports exact version identity when detection is unambiguous, and an approximate fallback otherwise', () => {
    const adapter = makeAdapter()

    const exact = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))
    expect(exact.version.exact).toBe('Emerald')
    expect(exact.version.approximateGeneration).toBe(3)
    expect(exact.version.aggregated).toBe('Emerald')
    exact.dispose()

    const ambiguous = adapter.load(
      encodeFixtureSaveBytes('fixture:gen3-ambiguous')
    )
    expect(ambiguous.version.exact).toBe('Unknown')
    expect(ambiguous.version.approximateGeneration).toBe(3)
    expect(ambiguous.version.aggregated).toContain('approximate')
    ambiguous.dispose()
  })

  it('imports a .pkm file and places it into a party slot and a box slot without mutating the originals', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))

    const imported: PokemonNode = {
      species: 6,
      form: 0,
      level: 50,
      gender: 'Male',
      shiny: false,
      isEgg: false,
      nickname: 'CHARIZARD',
      originalTrainerName: 'ASH',
      originalTrainerId: 1,
      originalTrainerSecretId: 2,
      heldItem: 0,
      heldItemName: '',
      nature: { id: 3, name: 'Adamant' },
      ability: { id: 66, name: 'Blaze' },
      moves: [{ id: 53, name: 'Flamethrower', pp: 15 }, null, null, null],
      ribbons: [
        {
          id: 1,
          name: 'Champion (Gen3)',
          shortName: 'Champion',
          iconFile: 'ribbonchampiong3.png',
        },
      ],
      ivs: {
        hp: 31,
        attack: 31,
        defense: 31,
        specialAttack: 31,
        specialDefense: 31,
        speed: 31,
      },
      evs: {
        hp: 0,
        attack: 252,
        defense: 0,
        specialAttack: 0,
        specialDefense: 4,
        speed: 252,
      },
      stats: {
        hp: 153,
        attack: 149,
        defense: 98,
        specialAttack: 116,
        specialDefense: 106,
        speed: 152,
      },
    }
    const roundTripped = adapter.importPokemonFile(
      encodePokemonFileBytes(imported)
    )
    expect(roundTripped).toEqual(imported)

    const nextParty = adapter.placeInParty(save.party, 3, roundTripped)
    expect(nextParty[3]).toEqual(imported)
    // Original party array is untouched.
    expect(save.party[3]).toBeNull()

    const nextBox = adapter.placeInBox(save.boxes[1], 5, roundTripped)
    expect(nextBox.slots[5]).toEqual(imported)
    expect(save.boxes[1].slots[5]).toBeNull()

    // Export round-trips back to bytes decodable as the same node.
    const exportedBytes = adapter.exportPokemonFile(roundTripped)
    const reimported = adapter.importPokemonFile(exportedBytes)
    expect(reimported).toEqual(imported)

    save.dispose()
  })

  it('passes detail fields (nature, ability, moves, stats, OT id) through unchanged', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))
    const pikachu = save.party[0]!

    expect(pikachu.nature).toEqual({ id: 0, name: 'Hardy' })
    expect(pikachu.ability).toEqual({ id: 9, name: 'Static' })
    expect(pikachu.moves).toHaveLength(4)
    expect(pikachu.moves[0]).toEqual({ id: 84, name: 'ThunderShock', pp: 30 })
    expect(Object.keys(pikachu.stats).sort()).toEqual([
      'attack',
      'defense',
      'hp',
      'specialAttack',
      'specialDefense',
      'speed',
    ])

    // Moves stay positional: empty slots are null, not omitted.
    const eevee = save.boxes[0].slots[0]!
    expect(eevee.moves).toHaveLength(4)
    expect(eevee.moves[3]).toBeNull()
    // A traded Pokemon keeps its own OT id, distinct from the save's trainer.
    expect(eevee.originalTrainerId).not.toBe(save.trainer.id)

    save.dispose()
  })

  it('makes dispose() idempotent and safe to call multiple times', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))

    expect(() => {
      save.dispose()
      save.dispose()
      save.dispose()
    }).not.toThrow()
  })

  it('moves a boxed Pokemon into an empty slot and persists the cleared source', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))
    const partyBefore = save.party.slice()
    const eevee = save.boxes[0].slots[0]

    save.movePokemon({ box: 0, slot: 0 }, { box: 1, slot: 5 })

    expect(save.boxes[0].slots[0]).toBeNull()
    expect(save.boxes[1].slots[5]).toBe(eevee)
    expect(save.party).toEqual(partyBefore)

    const reloaded = adapter.load(save.toBytes())
    expect(reloaded.boxes[0].slots[0]).toBeNull()
    expect(reloaded.boxes[1].slots[5]?.species).toBe(133)
    reloaded.dispose()
    save.dispose()
  })

  it('swaps two occupied box slots in move-one mode semantics', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))
    const first = save.boxes[0].slots[0]
    const second = save.boxes[0].slots[2]

    save.movePokemon({ box: 0, slot: 0 }, { box: 0, slot: 2 })

    expect(save.boxes[0].slots[0]).toBe(second)
    expect(save.boxes[0].slots[2]).toBe(first)
    save.dispose()
  })

  it('writes and clears a box slot through the explicit cross-storage boundary', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))
    const pokemon = save.boxes[0].slots[0]

    save.setBoxSlot({ box: 1, slot: 4 }, pokemon)
    expect(save.boxes[1].slots[4]).toBe(pokemon)
    save.setBoxSlot({ box: 0, slot: 0 }, null)
    expect(save.boxes[0].slots[0]).toBeNull()

    const reloaded = adapter.load(save.toBytes())
    expect(reloaded.boxes[1].slots[4]?.species).toBe(133)
    expect(reloaded.boxes[0].slots[0]).toBeNull()
    reloaded.dispose()
    save.dispose()
  })

  it('moves a group while preserving empty slots in its layout', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))

    save.movePokemonGroup([
      { from: { box: 0, slot: 0 }, to: { box: 1, slot: 6 } },
      { from: { box: 0, slot: 1 }, to: { box: 1, slot: 7 } },
      { from: { box: 0, slot: 2 }, to: { box: 1, slot: 8 } },
    ])

    expect(save.boxes[0].slots.slice(0, 3)).toEqual([null, null, null])
    expect(save.boxes[1].slots[6]?.species).toBe(133)
    expect(save.boxes[1].slots[7]).toBeNull()
    expect(save.boxes[1].slots[8]?.species).toBe(175)
    save.dispose()
  })

  it('rejects an empty source and group destinations occupied outside the selection', () => {
    const adapter = makeAdapter()
    const save = adapter.load(encodeFixtureSaveBytes('fixture:emerald'))

    expect(() =>
      save.movePokemon({ box: 0, slot: 1 }, { box: 1, slot: 0 })
    ).toThrow(/empty/i)
    expect(() =>
      save.movePokemonGroup([
        { from: { box: 0, slot: 0 }, to: { box: 0, slot: 2 } },
      ])
    ).toThrow(/outside the selected group/i)
    expect(save.boxes[0].slots[0]?.species).toBe(133)
    expect(save.boxes[0].slots[2]?.species).toBe(175)
    save.dispose()
  })
})
