import { describe, expect, it } from 'vitest'
import {
  getAcquisitionRoutes,
  getEggMoveFathers,
  getEggMoves,
  getEvolutionFamilyEdges,
  type PokedexDataset,
  type PokedexSpecies,
} from './index'

function species(
  id: number,
  options: Partial<PokedexSpecies> = {}
): PokedexSpecies {
  return {
    nationalDexNumber: id,
    romSpeciesIds: [id],
    name: `SPECIES${id}`,
    stats: {
      hp: 1,
      attack: 1,
      defense: 1,
      speed: 1,
      specialAttack: 1,
      specialDefense: 1,
    },
    types: [],
    catchRate: null,
    baseExperience: null,
    evYield: {},
    abilities: [],
    breeding: { eggGroups: ['Field'], genderRatio: 127, hatchCycles: 20 },
    heldItems: [],
    learnsets: { levelUp: [], egg: [], tmHm: [], tutor: [] },
    evolutions: { from: [], to: [] },
    pokedex: { category: null, flavorText: [], height: null, weight: null },
    encounters: [],
    ...options,
  }
}
function dataset(...rows: PokedexSpecies[]): PokedexDataset {
  return {
    schemaVersion: 1,
    extractorVersion: '',
    game: {
      id: 'firered',
      code: 'BPRE',
      title: 'FireRed',
      revision: 0,
      isRomHack: null,
    },
    romSha256: '',
    metadataFingerprint: null,
    species: Object.fromEntries(
      rows.map((row) => [row.nationalDexNumber, row])
    ),
    locations: {},
    warnings: [],
    capabilities: { encounters: 'available' },
  }
}
function evolve(data: PokedexDataset, from: number, to: number, level = 10) {
  data.species[from].evolutions.to.push({
    nationalDexNumber: to,
    method: 'level',
    parameter: level,
  })
  data.species[to].evolutions.from.push(from)
}
function wild(row: PokedexSpecies) {
  row.encounters.push({
    mapId: '0.1',
    mapName: 'TEST ROUTE',
    method: 'grass',
    minLevel: 3,
    maxLevel: 5,
    probability: 0.2,
  })
}
const move = (id: number) => ({
  romId: id,
  nationalMoveId: id,
  romName: `MOVE${id}`,
})

describe('reference family and acquisition queries', () => {
  it('shows both earlier evolution requirements when Beedrill is selected', () => {
    const data = dataset(species(13), species(14), species(15))
    evolve(data, 13, 14, 7)
    evolve(data, 14, 15, 10)
    expect(
      getEvolutionFamilyEdges(data, 15).map((edge) => [
        edge.from.nationalDexNumber,
        edge.to.nationalDexNumber,
        edge.parameter,
      ])
    ).toEqual([
      [13, 14, 7],
      [14, 15, 10],
    ])
    wild(data.species[13])
    expect(getAcquisitionRoutes(data, 15)[0]).toMatchObject({
      source: 13,
      steps: [
        { from: 13, to: 14, parameter: 7 },
        { from: 14, to: 15, parameter: 10 },
      ],
    })
  })

  it('orders baby stages before lower National Dex numbers and bounds cycles', () => {
    const data = dataset(species(172), species(25), species(26))
    evolve(data, 172, 25)
    evolve(data, 25, 26)
    expect(
      getEvolutionFamilyEdges(data, 26).map(
        (edge) => edge.from.nationalDexNumber
      )
    ).toEqual([172, 25])
    evolve(data, 26, 172)
    expect(getEvolutionFamilyEdges(data, 25)).toHaveLength(3)
    expect(() => getAcquisitionRoutes(data, 172)).not.toThrow()
  })

  it('includes inherited egg moves and their actual hatch species', () => {
    const data = dataset(species(4), species(5), species(6))
    evolve(data, 4, 5)
    evolve(data, 5, 6)
    data.species[4].learnsets.egg = [move(1), move(2)]
    expect(getEggMoves(data, 6)).toEqual([
      { move: move(1), hatchedAs: [4] },
      { move: move(2), hatchedAs: [4] },
    ])
  })

  it('finds compatible male egg-move fathers, including baby recipients', () => {
    const data = dataset(
      species(172, {
        breeding: {
          eggGroups: ['Undiscovered'],
          genderRatio: 127,
          hatchCycles: 10,
        },
      }),
      species(25, {
        breeding: {
          eggGroups: ['Field', 'Fairy'],
          genderRatio: 127,
          hatchCycles: 10,
        },
      }),
      species(100, {
        breeding: { eggGroups: ['Field'], genderRatio: 0, hatchCycles: 10 },
      }),
      species(101, {
        breeding: { eggGroups: ['Water 1'], genderRatio: 0, hatchCycles: 10 },
      }),
      species(102, {
        breeding: {
          eggGroups: ['Field'],
          genderRatio: 254,
          hatchCycles: 10,
        },
      })
    )
    evolve(data, 172, 25)
    data.species[100].learnsets.levelUp = [{ level: 5, move: move(1) }]
    data.species[101].learnsets.levelUp = [{ level: 5, move: move(1) }]
    data.species[102].learnsets.levelUp = [{ level: 5, move: move(1) }]
    expect(
      getEggMoveFathers(data, 1, [172]).map(
        (father) => father.nationalDexNumber
      )
    ).toEqual([100])
  })

  it('uses a breedable evolved parent to locate a baby with no wild encounters', () => {
    const data = dataset(
      species(172, {
        breeding: { eggGroups: [], genderRatio: 127, hatchCycles: 10 },
      }),
      species(25),
      species(26)
    )
    evolve(data, 172, 25)
    evolve(data, 25, 26)
    wild(data.species[25])
    expect(getAcquisitionRoutes(data, 172)[0]).toMatchObject({
      source: 25,
      steps: [
        { kind: 'breed', from: 25, to: 172, partner: 'compatible-or-ditto' },
      ],
    })
  })

  it('requires Ditto for male-only parents, and does not invent eggs for Ditto or undiscovered species', () => {
    const data = dataset(
      species(236, {
        breeding: { eggGroups: [], genderRatio: 0, hatchCycles: 20 },
      }),
      species(106, {
        breeding: {
          eggGroups: ['Human-Like'],
          genderRatio: 0,
          hatchCycles: 20,
        },
      }),
      species(132, {
        breeding: { eggGroups: ['Ditto'], genderRatio: 255, hatchCycles: 20 },
      }),
      species(150, {
        breeding: { eggGroups: [], genderRatio: 255, hatchCycles: 120 },
      })
    )
    evolve(data, 236, 106)
    wild(data.species[106])
    expect(getAcquisitionRoutes(data, 236)[0].steps[0]).toMatchObject({
      kind: 'breed',
      partner: 'ditto',
    })
    expect(getAcquisitionRoutes(data, 132)).toEqual([])
    expect(getAcquisitionRoutes(data, 150)).toEqual([])
  })

  it('preserves incense requirements and distinguishes Marill eggs from Azurill eggs', () => {
    const data = dataset(
      species(298, {
        breeding: { eggGroups: [], genderRatio: 127, hatchCycles: 10 },
      }),
      species(183)
    )
    evolve(data, 298, 183)
    wild(data.species[183])
    expect(getAcquisitionRoutes(data, 298)[0].steps[0]).toMatchObject({
      kind: 'breed',
      incenseItemId: 220,
    })
    data.species[183].encounters = []
    expect(
      getAcquisitionRoutes(data, 183).some((route) =>
        route.steps.some(
          (step) => step.kind === 'breed' && step.excludeIncenseItemId === 220
        )
      )
    ).toBe(true)
  })

  it('offers evolution without pretending a gift-only starting species has a wild location', () => {
    const data = dataset(species(4), species(5), species(6))
    evolve(data, 4, 5, 16)
    evolve(data, 5, 6, 36)
    expect(getAcquisitionRoutes(data, 6)).toEqual([
      {
        source: 5,
        encounters: [],
        steps: [
          { kind: 'evolve', from: 5, to: 6, method: 'level', parameter: 36 },
        ],
      },
    ])
  })
})
