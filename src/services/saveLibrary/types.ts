/**
 * Public types for the save library boundary.
 *
 * The save library is the abstraction that owns *bytes* (save files and ROM
 * files) for each recognized game slot, plus a human-readable audit log of
 * what happened to those bytes over time. It does not parse, validate, or
 * understand Pokémon data — that is the job of the Pokémon data adapter
 * (`src/services/pkhex`). This module only ever moves `Uint8Array`s around.
 */

/** Main-series generation number, 1 through 9. */
export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Gen1GameId = "red" | "blue" | "green" | "yellow";
export type Gen2GameId = "gold" | "silver" | "crystal";
export type Gen3GameId = "ruby" | "sapphire" | "emerald" | "firered" | "leafgreen";
export type Gen4GameId = "diamond" | "pearl" | "platinum" | "heartgold" | "soulsilver";
export type Gen5GameId = "black" | "white" | "black2" | "white2";
export type Gen6GameId = "x" | "y" | "omegaruby" | "alphasapphire";
export type Gen7GameId =
  | "sun"
  | "moon"
  | "ultrasun"
  | "ultramoon"
  | "letsgopikachu"
  | "letsgoeevee";
export type Gen8GameId = "sword" | "shield" | "brilliantdiamond" | "shiningpearl" | "legendsarceus";
export type Gen9GameId = "scarlet" | "violet";

/**
 * The full roster of recognized game slots, as a string union so that any
 * misuse (typo, unsupported game, wrong generation) is caught at compile
 * time rather than at runtime.
 */
export type GameId =
  | Gen1GameId
  | Gen2GameId
  | Gen3GameId
  | Gen4GameId
  | Gen5GameId
  | Gen6GameId
  | Gen7GameId
  | Gen8GameId
  | Gen9GameId;

/** The current save and ROM bytes held for a single game slot. */
export interface GameSlotContents {
  save: Uint8Array | null;
  rom: Uint8Array | null;
}

/**
 * The public save library interface. Implementations own where bytes are
 * actually persisted (in-memory for this pass; a future implementation could
 * back this with Dropbox or another remote store) without changing this
 * contract.
 *
 * `listHistory` returns an append-only, human-readable audit log for a game
 * slot — one line per mutation, most-recent-last. It is explicitly NOT a
 * snapshot/version-restore mechanism: there is no way to reactivate an old
 * entry from history. It exists purely so a UI can show "what happened to
 * this slot," not "roll back to this point."
 */
export interface SaveLibrary {
  /** Wait until durable browser storage has hydrated the in-memory cache. */
  whenReady(): Promise<void>;

  /** All recognized game ids for a given generation, in canonical order. */
  listGames(generation: Generation): GameId[];

  /** The audit log for a game slot, most-recent-last. Empty if untouched. */
  listHistory(gameId: GameId): string[];

  /** The currently stored save bytes for a game slot, or null if none. */
  getSave(gameId: GameId): Uint8Array | null;
  /** When the current save was last updated, or null if none is stored. */
  getSaveUpdatedAt(gameId: GameId): Date | null;
  /**
   * The save that the most recent `updateSave` replaced, or null if there is
   * none. One backup is kept per game slot.
   */
  getPreviousSave(gameId: GameId): Uint8Array | null;
  /**
   * Replace the save bytes for a game slot and append a history entry. The
   * save being replaced becomes the previous save.
   */
  updateSave(gameId: GameId, sav: Uint8Array): void;
  /** Clear the save bytes for a game slot and append a history entry. */
  discardSave(gameId: GameId): void;

  /** The currently stored ROM bytes for a game slot, or null if none. */
  getRom(gameId: GameId): Uint8Array | null;
  /** Replace the ROM bytes for a game slot and append a history entry. */
  updateRom(gameId: GameId, rom: Uint8Array): void;
  /** Clear the ROM bytes for a game slot and append a history entry. */
  discardRom(gameId: GameId): void;

  /** Convenience accessor combining the save and ROM bytes for a slot. */
  getGame(gameId: GameId): GameSlotContents;
}
