/**
 * Game and generation identifiers shared by the roster and by
 * `src/services/storage`, which owns where save and ROM bytes live.
 */

/** Main-series generation number, 1 through 9. */
export type Generation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type Gen1GameId = 'red' | 'blue' | 'green' | 'yellow'
export type Gen2GameId = 'gold' | 'silver' | 'crystal'
export type Gen3GameId =
  'ruby' | 'sapphire' | 'emerald' | 'firered' | 'leafgreen'
export type Gen4GameId =
  'diamond' | 'pearl' | 'platinum' | 'heartgold' | 'soulsilver'
export type Gen5GameId = 'black' | 'white' | 'black2' | 'white2'
export type Gen6GameId = 'x' | 'y' | 'omegaruby' | 'alphasapphire'
export type Gen7GameId =
  'sun' | 'moon' | 'ultrasun' | 'ultramoon' | 'letsgopikachu' | 'letsgoeevee'
export type Gen8GameId =
  'sword' | 'shield' | 'brilliantdiamond' | 'shiningpearl' | 'legendsarceus'
export type Gen9GameId = 'scarlet' | 'violet'

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
  | Gen9GameId
