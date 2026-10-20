import type { Gen3GameId } from './types'

/** Game code prefixes from the GBA header; the fourth letter is the region. */
export const GEN_3_GAME_CODE_PREFIX: Readonly<Record<Gen3GameId, string>> = {
  ruby: 'AXV',
  sapphire: 'AXP',
  emerald: 'BPE',
  firered: 'BPR',
  leafgreen: 'BPG',
}

/** The supported Gen 3 game a GBA header code belongs to. */
export function gen3GameIdFromCode(code: string): Gen3GameId | null {
  const entry = Object.entries(GEN_3_GAME_CODE_PREFIX).find(([, prefix]) =>
    code.startsWith(prefix)
  )
  return entry ? (entry[0] as Gen3GameId) : null
}
