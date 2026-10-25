import type { Gen3RomHeader } from './rom'
import { readRomPointer } from './rom'

export type OptionalTables = Partial<
  Record<
    | 'egg'
    | 'machines'
    | 'machineCompatibility'
    | 'wild'
    | 'mapBanks'
    | 'mapNames'
    | 'pokedexStats'
    | 'items'
    | 'regionalDex'
    | 'tutors'
    | 'tutorCompatibility',
    number
  >
>

type TutorTables = Pick<OptionalTables, 'tutors' | 'tutorCompatibility'>

/** Pointer sources from HexManiac Advance tableReference.txt (English rev 0/1). */
const SOURCES: Record<
  string,
  Required<Omit<OptionalTables, keyof TutorTables>>
> = {
  AXVE0: {
    mapNames: 1029456,
    mapBanks: 340772,
    machines: 454712,
    machineCompatibility: 263088,
    wild: 544156,
    egg: 269124,
    pokedexStats: 587016,
    items: 694512,
    regionalDex: 260080,
  },
  AXPE0: {
    mapNames: 1029456,
    mapBanks: 340772,
    machines: 454716,
    machineCompatibility: 263088,
    wild: 544156,
    egg: 269124,
    pokedexStats: 587016,
    items: 694512,
    regionalDex: 260080,
  },
  AXVE1: {
    mapNames: 1029488,
    mapBanks: 340804,
    machines: 454744,
    machineCompatibility: 263120,
    wild: 544188,
    egg: 269156,
    pokedexStats: 587048,
    items: 694544,
    regionalDex: 260080,
  },
  AXPE1: {
    mapNames: 1029488,
    mapBanks: 340804,
    machines: 454748,
    machineCompatibility: 263120,
    wild: 544188,
    egg: 269156,
    pokedexStats: 587048,
    items: 694544,
    regionalDex: 260080,
  },
  BPRE0: {
    mapNames: 789652,
    mapBanks: 348748,
    machines: 1202828,
    machineCompatibility: 277608,
    wild: 534928,
    egg: 285776,
    pokedexStats: 560692,
    items: 456,
    regionalDex: 274928,
  },
  BPGE0: {
    mapNames: 789608,
    mapBanks: 348748,
    machines: 1202788,
    machineCompatibility: 277608,
    wild: 534884,
    egg: 285776,
    pokedexStats: 560688,
    items: 456,
    regionalDex: 274928,
  },
  BPRE1: {
    mapNames: 789672,
    mapBanks: 348768,
    machines: 1202948,
    machineCompatibility: 277628,
    wild: 534948,
    egg: 285796,
    pokedexStats: 560712,
    items: 456,
    regionalDex: 274948,
  },
  BPGE1: {
    mapNames: 789628,
    mapBanks: 348768,
    machines: 1202908,
    machineCompatibility: 277628,
    wild: 534904,
    egg: 285796,
    pokedexStats: 560668,
    items: 456,
    regionalDex: 274948,
  },
  BPEE0: {
    mapNames: 1194820,
    mapBanks: 543396,
    machines: 1797392,
    machineCompatibility: 450632,
    wild: 740680,
    egg: 459760,
    pokedexStats: 784928,
    items: 456,
    regionalDex: 447484,
  },
}

/** Ruby and Sapphire have no move tutors. */
const TUTOR_SOURCES: Record<string, Required<TutorTables>> = {
  BPRE0: { tutors: 0x120be4, tutorCompatibility: 0x120c30 },
  BPGE0: { tutors: 0x120bbc, tutorCompatibility: 0x120c08 },
  BPRE1: { tutors: 0x120c5c, tutorCompatibility: 0x120ca8 },
  BPGE1: { tutors: 0x120c34, tutorCompatibility: 0x120c80 },
  BPEE0: { tutors: 0x1b236c, tutorCompatibility: 0x1b2390 },
}

export const OPTIONAL_ANCHORS: Record<string, keyof OptionalTables> = {
  'data.pokemon.moves.egg': 'egg',
  'data.pokemon.moves.tms': 'machines',
  'data.pokemon.moves.tmcompatibility': 'machineCompatibility',
  'data.pokemon.wild': 'wild',
  'data.maps.banks': 'mapBanks',
  'data.maps.names': 'mapNames',
  'data.pokedex.stats': 'pokedexStats',
  'data.items.stats': 'items',
  'data.pokedex.regional': 'regionalDex',
  'data.pokemon.moves.tutors': 'tutors',
  'data.pokemon.moves.tutorcompatibility': 'tutorCompatibility',
}

export function optionalTables(
  bytes: Uint8Array,
  header: Gen3RomHeader
): OptionalTables {
  const key = `${header.code}${header.revision}`
  const sources = SOURCES[key] && { ...SOURCES[key], ...TUTOR_SOURCES[key] }
  if (!sources) return {}
  return Object.fromEntries(
    Object.entries(sources).flatMap(([key, source]) => {
      const target = readRomPointer(bytes, source)
      return target === null ? [] : [[key, target]]
    })
  )
}
