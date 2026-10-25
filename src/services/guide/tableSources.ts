import type { Gen3RomHeader } from './rom'
import { readRomPointer } from './rom'

export type OptionalTables = Partial<
  Record<
    | 'egg'
    | 'machines'
    | 'machineCompatibility'
    | 'wild'
    | 'mapBanks'
    | 'mapNames',
    number
  >
>

/** Pointer sources from HexManiac Advance tableReference.txt (English rev 0/1). */
const SOURCES: Record<string, Required<OptionalTables>> = {
  AXVE0: {
    mapNames: 1029456,
    mapBanks: 340772,
    machines: 454712,
    machineCompatibility: 263088,
    wild: 544156,
    egg: 269124,
  },
  AXPE0: {
    mapNames: 1029456,
    mapBanks: 340772,
    machines: 454716,
    machineCompatibility: 263088,
    wild: 544156,
    egg: 269124,
  },
  AXVE1: {
    mapNames: 1029488,
    mapBanks: 340804,
    machines: 454744,
    machineCompatibility: 263120,
    wild: 544188,
    egg: 269156,
  },
  AXPE1: {
    mapNames: 1029488,
    mapBanks: 340804,
    machines: 454748,
    machineCompatibility: 263120,
    wild: 544188,
    egg: 269156,
  },
  BPRE0: {
    mapNames: 789652,
    mapBanks: 348748,
    machines: 1202828,
    machineCompatibility: 277608,
    wild: 534928,
    egg: 285776,
  },
  BPGE0: {
    mapNames: 789608,
    mapBanks: 348748,
    machines: 1202788,
    machineCompatibility: 277608,
    wild: 534884,
    egg: 285776,
  },
  BPRE1: {
    mapNames: 789672,
    mapBanks: 348768,
    machines: 1202948,
    machineCompatibility: 277628,
    wild: 534948,
    egg: 285796,
  },
  BPGE1: {
    mapNames: 789628,
    mapBanks: 348768,
    machines: 1202908,
    machineCompatibility: 277628,
    wild: 534904,
    egg: 285796,
  },
  BPEE0: {
    mapNames: 1194820,
    mapBanks: 543396,
    machines: 1797392,
    machineCompatibility: 450632,
    wild: 740680,
    egg: 459760,
  },
}

export const OPTIONAL_ANCHORS: Record<string, keyof OptionalTables> = {
  'data.pokemon.moves.egg': 'egg',
  'data.pokemon.moves.tms': 'machines',
  'data.pokemon.moves.tmcompatibility': 'machineCompatibility',
  'data.pokemon.wild': 'wild',
  'data.maps.banks': 'mapBanks',
  'data.maps.names': 'mapNames',
}

export function optionalTables(
  bytes: Uint8Array,
  header: Gen3RomHeader
): OptionalTables {
  const sources = SOURCES[`${header.code}${header.revision}`]
  if (!sources) return {}
  return Object.fromEntries(
    Object.entries(sources).flatMap(([key, source]) => {
      const target = readRomPointer(bytes, source)
      return target === null ? [] : [[key, target]]
    })
  )
}
