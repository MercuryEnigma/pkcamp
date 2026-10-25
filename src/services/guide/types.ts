import type { Gen3GameId } from '../saveLibrary'

export const POKEDEX_SCHEMA_VERSION = 1
export const POKEDEX_EXTRACTOR_VERSION = '0.3.0'

export type PokedexWarningCode =
  | 'unsupported-rom'
  | 'unknown-game-revision'
  | 'unmapped-species'
  | 'unsupported-table'
  | 'storage-unavailable'
  | 'partial-data'

export interface PokedexWarning {
  code: PokedexWarningCode
  detail?: string
}

export interface PokedexMoveRef {
  /** The move ID as encoded in this ROM. */
  romId: number
  /** Standard move ID where the mapping is known. */
  nationalMoveId: number | null
  /** ROM-decoded spelling, retained for hack-specific names. */
  romName: string | null
  machine?: { kind: 'tm' | 'hm'; number: number }
}

export interface PokedexEvolution {
  from: number[]
  to: {
    nationalDexNumber: number
    method: string
    parameter: number | string | null
  }[]
}

export interface PokedexEncounter {
  mapId: string
  mapName: string
  method: string
  minLevel: number
  maxLevel: number
  /** Fraction of encounter slots for this species, conditional on an encounter. */
  probability: number | null
  /** ROM encounter activation rate, separate from the slot probability. */
  encounterRate?: number
  conditions?: string[]
}

export interface PokedexSpecies {
  nationalDexNumber: number
  romSpeciesIds: number[]
  name: string
  stats: {
    hp: number
    attack: number
    defense: number
    specialAttack: number
    specialDefense: number
    speed: number
  }
  types: string[]
  catchRate: number | null
  baseExperience: number | null
  evYield: Record<string, number>
  abilities: string[]
  breeding: {
    eggGroups: string[]
    genderRatio: number | null
    hatchCycles: number | null
  }
  heldItems: {
    itemId: number
    name: string | null
    probability: number | null
  }[]
  learnsets: {
    levelUp: { level: number; move: PokedexMoveRef }[]
    egg: PokedexMoveRef[]
    tmHm: PokedexMoveRef[]
    tutor: PokedexMoveRef[]
  }
  evolutions: PokedexEvolution
  pokedex: {
    category: string | null
    flavorText: string[]
    height: number | null
    weight: number | null
  }
  encounters: PokedexEncounter[]
}

export interface PokedexDataset {
  schemaVersion: number
  extractorVersion: string
  game: {
    id: Gen3GameId
    code: string
    title: string
    revision: number
    isRomHack: boolean | null
  }
  romSha256: string
  metadataFingerprint: string | null
  species: Record<number, PokedexSpecies>
  /** Map IDs to National Dex numbers; encounter detail lives on each species. */
  locations: Record<string, number[]>
  warnings: PokedexWarning[]
  capabilities: Record<string, 'available' | 'partial' | 'unavailable'>
}

export interface ExtractOptions {
  metadata?: string
}

export class UnsupportedRomError extends Error {}
