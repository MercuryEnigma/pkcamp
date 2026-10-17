import type { Gen3GameId } from '../../../services/saveLibrary'
import type { PokemonNode } from '../../../services/pkhex'
import type { CampPosition } from '../../../services/storage'

export type Scalar = string | number | boolean
/** A scalar is an exact match; an array means "one of". */
export type Constraint = Scalar | Scalar[]

/** Constraint fields the evaluator can check (see `FIELD_MATCHERS`). */
export type ConstraintField =
  | 'species'
  | 'form'
  | 'gender'
  | 'shiny'
  | 'isEgg'
  | 'level'
  | 'nickname'
  | 'ot'
  | 'id'
  | 'item'
  | 'ability'
  | 'nature'
  | 'moves'
  | 'ribbons'
  | 'all_moves'
  | 'all_ribbons'

export type EntryConstraints = Partial<Record<ConstraintField, Constraint>>

export interface CollectionGroup {
  id: string
  name: string
  description?: string
  details?: string
  /** Entry ids, each a key of `CollectionDefinition.pokemon`. */
  pokemon: string[]
}

export interface CollectionMetadata {
  version: string
  author?: string
  description?: string
  details?: string
  source?: string
  updated?: string
}

export interface CollectionDefinition {
  schemaVersion: string
  id: string
  name: string
  metadata: CollectionMetadata
  groups: CollectionGroup[]
  /** Key = entry id. */
  pokemon: Record<string, EntryConstraints>
}

export type PokemonLocation = 'party' | { box: number; slot: number }

/** Scanned Lab sources: a Gen 3 Cabin's save, or the Gen 3 Camp Sites. */
export const CAMP_SOURCE = 'camp'
export type LabSourceId = Gen3GameId | typeof CAMP_SOURCE

export interface ScannedPokemon {
  node: PokemonNode
  source:
    | {
        gameId: Gen3GameId
        location: PokemonLocation
        boxName?: string
      }
    | { camp: true; location: CampPosition }
}

export interface EntryMatch {
  entryId: string
  matched: boolean
  matches: ScannedPokemon[]
}

export type EntryStatus = 'owned' | 'seen' | 'unseen'

export const STATUS_LABEL: Record<EntryStatus, string> = {
  owned: 'Owned',
  seen: 'Seen',
  unseen: 'Unseen',
}

/** The Gen 3 Camp Sites' scan, with a digest of where each Pokémon sits. */
export type CampScanStatus =
  | { state: 'ok'; count: number; unreadable: number; fingerprint: string }
  | { state: 'error'; message: string }

export type CabinScanStatus =
  | { gameId: Gen3GameId; state: 'ok'; updatedAt: Date; count: number }
  | { gameId: Gen3GameId; state: 'empty' }
  | { gameId: Gen3GameId; state: 'error'; message: string }
