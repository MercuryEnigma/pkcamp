/**
 * pkhex-wasm — PKHeX.Core Pokémon save editing, compiled to WebAssembly.
 *
 * Load a real save file in the browser, inspect and edit box/party Pokémon,
 * and export valid save bytes back out. Synchronous operations after a
 * one-time async init; no Blazor anywhere.
 *
 * ### Supported generations (v1)
 *
 * | Tier | Behavior | Generations |
 * | --- | --- | --- |
 * | Edit | all mutators apply | Gen 3, 4, 5, 6, 7, SwSh, BDSP, SV, Legends Z-A |
 * | Read-only | mutators throw | Gen 1, 2, LGPE, PLA |
 *
 * Natures do not exist before Gen 3 and are written mint-aware on modern formats.
 * See each mutator's `@throws` for tier behavior.
 *
 * @module
 */
/** Six-stat block shared by IVs, EVs, and computed stats. */
export interface StatBlock {
  /** HP stat / individual value / effort value. */
  readonly health: number
  /** Attack. */
  readonly attack: number
  /** Defense. */
  readonly defense: number
  /** Special attack. */
  readonly specialAttack: number
  /** Special defense. */
  readonly specialDefense: number
  /** Speed. */
  readonly speed: number
}

/** A reference into a global lookup table: numeric id plus display name. */
export interface LookupRef {
  /** Numeric id used by every mutator and table lookup. */
  readonly id: number
  /** Display name. */
  readonly name: string
}

/** One of an entity's four move slots. */
export interface MoveSlot {
  /** The move in this slot. */
  readonly move: LookupRef
  /** Current power points remaining for this slot. */
  readonly pp: number
}

/** One ribbon an entity currently holds.  `id` follows Core's `RibbonIndex` enum (the modern, post-Generation-3 ribbon set) where a ribbon has one, else `RibbonIndex3` offset by 1000 (ribbons that only ever existed within Generation 3), else `-1` when Core has no stable numeric id for it at all. */
export interface RibbonRef extends LookupRef {
  /** Display name with pkcamp's Gen-3-scoped presentation applied: Core's cross-generation disambiguating qualifiers (e.g. "Champion (Gen3)") stripped to just "Champion" for the handful of ribbons that carry one. Equal to `name` for every other ribbon. */
  readonly shortName: string
  /** Icon filename (no directory) from PKHeX.Core's own ribbon icon set (`lowercase(propertyName) + ".png"`). */
  readonly iconFile: string
}

/** Original-trainer attribution carried on every entity. */
export interface TrainerRef {
  /** Trainer name. */
  readonly name: string
  /** Trainer ID pair (`tid` visible in game; `sid` hidden secret id). */
  readonly id: { tid: number; sid: number }
  /** Trainer gender. */
  readonly gender: 'male' | 'female' | 'unspecified'
}

/** Read-only trainer information exposed by a save. */
export interface TrainerInfo extends TrainerRef {
  /** Money held, when the format tracks it. */
  readonly money?: number
}

/** Immutable build-time-generated lookup table over universal reference data (species, natures, moves). */
export interface LookupTable<T> {
  /** Number of entries. */
  readonly size: number
  /** Look up one entry by id. */
  get(id: number): T | undefined
  /** Every entry, ordered by id. */
  all(): readonly T[]
}

/** Species entry in the global species table. */
export interface SpeciesInfo extends LookupRef {
  /** National Pokédex number; identical to the inherited id. */
  readonly nationalDex: number
  /** Type lineup. */
  readonly types: readonly string[]
  /** Base stat spread. */
  readonly baseStats: StatBlock
}

/** Nature entry in the global nature table. */
export interface NatureInfo extends LookupRef {
  /** Stat multipliers this nature applies (1.0 neutral). */
  readonly statMultipliers: {
    attack: number
    defense: number
    speed: number
    specialAttack: number
    specialDefense: number
  }
}

/** Move entry in the global move table.  Carries only what Core itself tracks (type, PP). Base power and accuracy are absent from PKHeX.Core; sourcing them externally is tracked as a post-v1 enhancement. */
export interface MoveInfo extends LookupRef {
  /** Move type. */
  readonly type: string
  /** Base power points. */
  readonly pp: number
}

/** Item entry in a per-game item table. */
export interface ItemInfo extends LookupRef {
  /** Flavor text, when available. */
  readonly description?: string
}

/** Options for the one-time asynchronous initialization of the wasm runtime. */
export interface InitOptions {
  /**
   * Base URL the runtime fetches its `_framework` assets from.
   *
   * Defaults to the package's own bundled runtime directory.
   */
  readonly wasmBaseUrl?: string
}

/** A loaded save file. All accessors return snapshots; entity Handles write through to the underlying save, and changes are reflected on the next {@link PKHex.saveBytes} call. */
export interface Game {
  /** Read-only trainer data (name and ID are readable in v1; not editable). */
  readonly trainer: TrainerInfo
  /** Number of storage boxes this save format provides (e.g. 14 in Gen 3). */
  readonly boxCount: number
  /** Per-game item lookup table (game-dependent data stays version-scoped). */
  readonly items: LookupTable<ItemInfo>
  /** Generation context of the loaded save, e.g. `"Gen1"`, `"Gen8b"`. */
  readonly generation: string
  /**
   * Exact game recorded in the save, e.g. `"E"` (Emerald) or `"FR"` (FireRed) — finer than {@link Game.generation}.
   *
   * Where Core stores only a family (Gen 1 saves carry no version byte), this is the family name, e.g. `"RB"`, and {@link Game.isVersionAggregated} is `true`.
   */
  readonly saveVersion: string
  /** `true` when {@link Game.saveVersion} names a game family rather than one exact title. */
  readonly isVersionAggregated: boolean
  /**
   * Snapshot of one storage box. Slot order matches the game's own ordering; empty slots are absent from the array.
   *
   * @param index zero-based box index, `< boxCount`
   * @throws {RangeError} when `index` is outside `[0, boxCount)`
   */
  box(index: number): Pokemon[]
  /** Snapshot of the party (up to six entities). */
  party(): Pokemon[]
  /**
   * Display name of one storage box (`"Box N"` for formats that store none).
   *
   * @param index zero-based box index, `< boxCount`
   * @throws {RangeError} when `index` is outside `[0, boxCount)`
   */
  boxName(index: number): string
  /**
   * Positional snapshot of one storage box: one entry per slot in the game's order, `null` where the slot is empty. Use this over {@link Game.box} for a faithful box grid.
   *
   * @param index zero-based box index, `< boxCount`
   * @throws {RangeError} when `index` is outside `[0, boxCount)`
   */
  boxSlots(index: number): (Pokemon | null)[]
  /** Positional snapshot of the party: six entries, `null` where a slot is empty. */
  partySlots(): (Pokemon | null)[]
  /**
   * Place an entity at exactly box `boxIndex`, slot `slot`, overwriting any occupant (converted into this save's format when needed), or pass `null` to clear it. The Handle then refers to the placed entity.
   *
   * @throws {RangeError} when the box or slot index is out of range
   */
  setBoxSlot(boxIndex: number, slot: number, pokemon: Pokemon | null): void
  /** Release this save and every entity Handle materialized from it on the wasm side. Idempotent; a disposed Handle must not be used again. */
  dispose(): void
}

/** A single Pokémon entity. Reads are always available; mutators apply only within the edit tier (Gen 3–7, SwSh, BDSP, SV, Legends Z-A) and throw descriptive errors elsewhere. */
export interface Pokemon {
  /** Species reference (national dex id + display name). Read-only in v1. */
  readonly species: LookupRef
  /** Current nickname. */
  readonly nickname: string
  /** Current level. */
  readonly level: number
  /** Shiny state. */
  readonly isShiny: boolean
  /** Gender. */
  readonly gender: 'male' | 'female' | 'genderless'
  /** Individual values. Gen 1–2 caps at 15 with special-defense aliasing special. */
  readonly ivs: Readonly<StatBlock>
  /** Effort values (legacy scales on Gen 1–2; absent systems on LGPE/PLA reads). */
  readonly evs: Readonly<StatBlock>
  /** Computed battle stats derived from species/level/IVs/EVs/nature. */
  readonly stats: Readonly<StatBlock>
  /** Four move slots; empty slots carry move id `0`. */
  readonly moves: readonly MoveSlot[]
  /** Current nature. `null` on Gen 1–2 entities, where the concept does not exist. */
  readonly nature: LookupRef | null
  /**
   * Ribbons currently held, in Core's declaration order. Empty when none.
   *
   * Which ribbon properties exist at all is generation-dependent (Core
   * exposes them via per-generation `IRibbonSetXxx` marker interfaces on
   * the concrete entity type); this reads whichever ones the loaded
   * entity's format actually has.
   */
  readonly ribbons: readonly RibbonRef[]
  /** Original-trainer attribution. */
  readonly owner: TrainerRef
  /** Alternate-form index; `0` is the base form. */
  readonly form: number
  /** Egg state. */
  readonly isEgg: boolean
  /** Held-item id; `0` when nothing is held. */
  readonly heldItem: number
  /** Held-item display name in this entity's own format's item index space; empty when nothing is held. */
  readonly heldItemName: string
  /** Current ability. `null` on Gen 1–2 entities, where the concept does not exist. */
  readonly ability: LookupRef | null
  /** Level/nature/IV/EV-adjusted stats with max HP; recomputed for boxed entities, which store none. */
  readonly battleStats: Readonly<StatBlock>
  /** Original trainer's ID pair as the games display it (6-digit split on Gen 7+). */
  readonly ownerDisplayId: { tid: number; sid: number }
  /** This entity as standalone `.pk*` file bytes (decrypted party layout, as PKHeX writes single-entity files). A fresh array per call. */
  toBytes(): Uint8Array
  /** Release this entity's wasm-side Handle. Idempotent. Needed for entities from {@link PKHex.parsePkm}, which no {@link Game.dispose} owns. */
  release(): void
  /**
   * Rename this entity.
   *
   * @throws {UnsupportedTierError} on read-only-tier saves
   * @throws {RangeError} when exceeding the generation's nickname length or charset limits
   */
  setNickname(nickname: string): void
  /**
   * Set the level; experience is adjusted accordingly.
   *
   * Values outside `1..100` clamp, mirroring the game's own behavior.
   *
   * @throws {UnsupportedTierError} on read-only-tier saves
   */
  setLevel(level: number): void
  /**
   * Overwrite all four move slots (ids in the global move table; `0` clears).
   *
   * @throws {UnsupportedTierError} on read-only-tier saves
   * @throws {RangeError} when an id is unknown to this generation's movepool
   */
  setMoves(moveIds: readonly [number, number, number, number]): void
  /**
   * Set the nature (mint-aware on Gen 8+ formats).
   *
   * @throws {UnsupportedOperationError} on Gen 1–2 (natures do not exist)
   * @throws {UnsupportedTierError} on other read-only-tier saves
   */
  setNature(natureId: number): void
  /**
   * Force shiny on or off (PID manipulation on Gen 3+).
   *
   * Read-only tiers — including Gen 1–2, where shiny is DV-derived and the upstream unset path is hazardous — reject before reaching Core.
   *
   * @throws {UnsupportedTierError} on read-only-tier saves
   */
  setShiny(shiny: boolean): void
  /**
   * Merge individual values; omitted stats keep their current value.
   *
   * Values clamp per generation (31 standard, 15 on Gen 1–2).
   *
   * @throws {UnsupportedTierError} on read-only-tier saves
   */
  setIVs(partial: Partial<StatBlock>): void
  /**
   * Merge effort values; omitted stats keep their current value.
   *
   * Caps follow the generation (252/510 standard; legacy scale on Gen 1–2).
   *
   * @throws {UnsupportedTierError} on read-only-tier saves
   */
  setEVs(partial: Partial<StatBlock>): void
}

/** The initialized API root. Every operation here is synchronous. */
export interface PKHex {
  /** Global species table (national dex). */
  readonly species: LookupTable<SpeciesInfo>
  /** Global nature table. */
  readonly natures: LookupTable<NatureInfo>
  /** Global move table. */
  readonly moves: LookupTable<MoveInfo>
  /**
   * Parse a complete save-file buffer into an editable {@link Game}.
   *
   * The input is defensively copied; callers retain ownership of `saveBytes`.
   *
   * @param saveBytes one complete logical save buffer (up to ~4.4 MB; Switch-era main/backup/poke_trade files must be assembled by the caller)
   * @throws {SaveParseError} when the bytes match no supported format
   */
  load(saveBytes: Uint8Array): Game
  /** Serialize a game back to a fresh save-file byte array. Every call returns a new `Uint8Array`; nothing aliases prior exports. */
  saveBytes(game: Game): Uint8Array
  /**
   * Parse a standalone `.pk*` file into a detached entity (no owning save). Place it with {@link Game.setBoxSlot}; release it with {@link Pokemon.release}.
   *
   * @param pkmBytes one single-entity file
   * @throws {SaveParseError} when the bytes match no supported entity format
   */
  parsePkm(pkmBytes: Uint8Array): Pokemon
}

/** Thrown by {@link PKHex.load} for unrecognized or corrupt buffers. */
export class SaveParseError extends Error {}

/** Thrown when a mutator is called on a read-only-tier generation (Gen 1–2, LGPE, PLA). The message names the unsupported operation. */
export class UnsupportedTierError extends Error {}

/** Thrown when an operation has no meaning for the entity's generation (e.g. setting natures before Gen 3). */
export class UnsupportedOperationError extends Error {}
/**
 * Initialize the wasm runtime exactly once; every subsequent operation on the returned root is synchronous.
 *
 * @param options runtime bootstrap options
 * @example
 * ```ts
 * import { initPKHex } from 'pkhex-wasm';
 *
 * const PKHex = await initPKHex();
 * const game = PKHex.load(saveBytes);
 * game.box(0)[0].setNickname('Sparky');
 * const out = PKHex.saveBytes(game);
 * ```
 */
export declare function initPKHex(options?: InitOptions): Promise<PKHex>
