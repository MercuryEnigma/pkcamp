import type { Generation, GameId } from "./types";

/**
 * The fixed game roster, keyed by generation, in the canonical display order
 * described in the Poké Storage roadmap (e.g. Gen 3 -> Ruby, Sapphire,
 * Emerald, FireRed, LeafGreen). `gameId` values are the game's own lowercase
 * name, not a synthetic id, per the approved boundary.
 */
export const ROSTER: Readonly<Record<Generation, readonly GameId[]>> = Object.freeze({
  1: Object.freeze<GameId[]>(["red", "blue", "green", "yellow"]),
  2: Object.freeze<GameId[]>(["gold", "silver", "crystal"]),
  3: Object.freeze<GameId[]>(["ruby", "sapphire", "emerald", "firered", "leafgreen"]),
  4: Object.freeze<GameId[]>(["diamond", "pearl", "platinum", "heartgold", "soulsilver"]),
  5: Object.freeze<GameId[]>(["black", "white", "black2", "white2"]),
  6: Object.freeze<GameId[]>(["x", "y", "omegaruby", "alphasapphire"]),
  7: Object.freeze<GameId[]>([
    "sun",
    "moon",
    "ultrasun",
    "ultramoon",
    "letsgopikachu",
    "letsgoeevee",
  ]),
  8: Object.freeze<GameId[]>([
    "sword",
    "shield",
    "brilliantdiamond",
    "shiningpearl",
    "legendsarceus",
  ]),
  9: Object.freeze<GameId[]>(["scarlet", "violet"]),
});

/** All recognized game ids across every generation, flattened. */
export const ALL_GAME_IDS: readonly GameId[] = Object.freeze(
  (Object.keys(ROSTER) as unknown as Generation[])
    .sort((a, b) => a - b)
    .flatMap((generation) => ROSTER[generation]),
);

export function generationOf(gameId: GameId): Generation {
  for (const key of Object.keys(ROSTER) as unknown as Generation[]) {
    if (ROSTER[key].includes(gameId)) {
      return key;
    }
  }
  // Unreachable for any valid GameId; kept defensive for runtime safety.
  throw new Error(`Unknown gameId: ${gameId}`);
}
