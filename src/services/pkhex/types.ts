/**
 * Normalized, backend-agnostic types for the PKHeX adapter boundary.
 *
 * These shapes mirror the object graph exposed by PKHeX.Facade
 * (https://github.com/arleypadua/PKHeX.Everywhere/tree/main/src/PKHeX.Facade):
 * `Game` (SaveVersion / GameVersionApproximation), `Trainer` (Party / PokemonBox),
 * and `Pokemon` (Form / Egg.IsEgg / LoadFrom / ToFile) — adapted to TypeScript and
 * to the fact that a WASM-backed implementation may retain native-side state that
 * needs explicit disposal.
 */

/**
 * Exact game identity. `'Unknown'` means the backend could not pin down the
 * precise version (see {@link GameVersionIdentity.approximateGeneration} for the
 * fallback in that case).
 */
export type GameVersion =
  | 'Red'
  | 'Blue'
  | 'Yellow'
  | 'Gold'
  | 'Silver'
  | 'Crystal'
  | 'Ruby'
  | 'Sapphire'
  /** Ruby and Sapphire share a save format, so a save names only the pair. */
  | 'RubySapphire'
  | 'Emerald'
  | 'FireRed'
  | 'LeafGreen'
  | 'Diamond'
  | 'Pearl'
  | 'Platinum'
  | 'HeartGold'
  | 'SoulSilver'
  | 'Black'
  | 'White'
  | 'Black2'
  | 'White2'
  | 'X'
  | 'Y'
  | 'OmegaRuby'
  | 'AlphaSapphire'
  | 'Sun'
  | 'Moon'
  | 'UltraSun'
  | 'UltraMoon'
  | 'LetsGoPikachu'
  | 'LetsGoEevee'
  | 'Sword'
  | 'Shield'
  | 'BrilliantDiamond'
  | 'ShiningPearl'
  | 'LegendsArceus'
  | 'Scarlet'
  | 'Violet'
  | 'Unknown'

/** Generation number, used as the coarse fallback tier of version identity. */
export type GameGeneration = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/**
 * Two-tier version identity, mirroring the Facade's `SaveVersion` (exact) plus
 * `GameVersionApproximation` (generation-level fallback used when the exact game
 * can't be disambiguated, e.g. Ruby vs. Sapphire vs. Emerald) and `Aggregated`
 * (a single human-readable label combining the two).
 */
export interface GameVersionIdentity {
  /** Exact game, or `'Unknown'` if the backend could only narrow to a generation. */
  exact: GameVersion
  /** Generation-level fallback. Present even when `exact` is known. */
  approximateGeneration: GameGeneration
  /** Human-readable label: the exact game name, or "Gen N (approximate)". */
  aggregated: string
}

export type Gender = 'Male' | 'Female' | 'Genderless'

/** A game-data reference: numeric id plus its English display name. */
export interface NamedRef {
  id: number
  name: string
}

/**
 * One ribbon currently held. `name` is PKHeX.Core's own official display
 * name, which disambiguates ribbons that repeat across generations for
 * Core's own cross-generation UI (e.g. "Champion (Gen3)"). `shortName` is
 * this app's Gen-3-scoped presentation of the same ribbon with that
 * qualifier stripped where one exists (e.g. "Champion"); it equals `name`
 * for every ribbon that doesn't carry one. `iconFile` is the filename (no
 * directory) of this ribbon's icon under `public/ribbons/`, sourced from
 * PKHeX.Core's own ribbon icon set (see `public/ribbons/PROVENANCE.md`).
 */
export interface RibbonRef extends NamedRef {
  shortName: string
  iconFile: string
}

/** One six-stat spread (IVs, EVs, or computed stats). */
export interface StatSpread {
  hp: number
  attack: number
  defense: number
  specialAttack: number
  specialDefense: number
  speed: number
}

/** One occupied move slot. */
export interface MoveNode extends NamedRef {
  /** Current power points remaining. */
  pp: number
}

/**
 * A single Pokemon's normalized, read-mostly data. Deliberately excludes
 * field-level setters (level/nickname/moves/species mutation) — those are out
 * of scope for this adapter; only whole-node import/export is supported.
 */
export interface PokemonNode {
  /** National Pokedex number. */
  species: number
  /** Alternate form index (0 = base form). */
  form: number
  level: number
  gender: Gender
  shiny: boolean
  isEgg: boolean
  nickname: string
  /** Original trainer name recorded on this Pokemon, if any. */
  originalTrainerName: string
  /**
   * The original trainer's ID as the games display it — this Pokemon's own,
   * which differs from the save's trainer for traded Pokemon.
   */
  originalTrainerId: number
  /** The original trainer's displayed Secret ID on this Pokemon. */
  originalTrainerSecretId: number
  /** Held-item id in this Pokemon's own format's item index space (0 = none). */
  heldItem: number
  /** Held-item display name; `''` when nothing is held. */
  heldItemName: string
  /** `null` where the concept does not exist (Gen 1–2). */
  nature: NamedRef | null
  /** `null` where the concept does not exist (Gen 1–2). */
  ability: NamedRef | null
  /** Exactly four positional slots; `null` is an empty slot. */
  moves: (MoveNode | null)[]
  /** Ribbons currently held, in the backend's declaration order. Empty when none. */
  ribbons: RibbonRef[]
  ivs: StatSpread
  evs: StatSpread
  /** In-battle stats derived from species, level, nature, IVs and EVs (max HP). */
  stats: StatSpread
}

/**
 * A single slot in a party or box. `null` is a real, positional entry
 * representing an empty slot — callers must not filter these out, since the
 * box grid needs faithful positions.
 */
export type SaveSlot = PokemonNode | null

/** A fixed-length, positional list of party slots (empty slots are `null`). */
export type PartyNode = SaveSlot[]

/** A single box: a name plus its fixed-length, positional slots. */
export interface BoxNode {
  name: string
  slots: SaveSlot[]
}

export interface TrainerNode {
  name: string
  id: number
  secretId: number
}

/** A box-only location. Party slots deliberately cannot be represented here. */
export interface BoxLocation {
  box: number
  slot: number
}

/** One source-to-destination entry in a group move. */
export interface PokemonMove {
  from: BoxLocation
  to: BoxLocation
}

/**
 * Top-level handle for a loaded save file. Mirrors the Facade's `Game`
 * (Trainer, Party, PokemonBox, SaveVersion/GameVersionApproximation), with the
 * addition of `dispose()` for backends that retain native/WASM-side state.
 *
 * `dispose()` must be safe to call multiple times (idempotent) and safe to
 * call even if load partially failed.
 */
export interface SaveGame {
  trainer: TrainerNode
  party: PartyNode
  boxes: BoxNode[]
  version: GameVersionIdentity
  /** Move one boxed Pokemon into an empty slot, or swap it with the occupant. */
  movePokemon(from: BoxLocation, to: BoxLocation): void
  /** Move a set of box slots as one layout-preserving operation. */
  movePokemonGroup(moves: readonly PokemonMove[]): void
  /** Write or clear one box slot. Party slots are intentionally unsupported. */
  setBoxSlot(location: BoxLocation, pokemon: PokemonNode | null): void
  /** Commit the current in-memory save state and return downloadable/persistable bytes. */
  toBytes(): Uint8Array
  /** Releases any retained backend state. Idempotent. */
  dispose(): void
}
