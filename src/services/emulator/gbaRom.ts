import { i18n } from '../i18n'
import type { Gen3GameId } from '../saveLibrary'
import { gen3GameIdFromCode } from '../saveLibrary'

const GAME_CODE_OFFSET = 0xac
const GAME_CODE_LENGTH = 4
const MIN_GBA_ROM_SIZE = 192

export interface GbaRomIdentity {
  gameId: Gen3GameId
  gameCode: string
}

/** Reads the four-character game code from a GBA cartridge header. */
export function gbaGameCode(bytes: Uint8Array): string | null {
  if (bytes.length < MIN_GBA_ROM_SIZE) return null
  const code = String.fromCharCode(
    ...bytes.subarray(GAME_CODE_OFFSET, GAME_CODE_OFFSET + GAME_CODE_LENGTH)
  )
  return /^[A-Z0-9]{4}$/.test(code) ? code : null
}

/** Identifies one of Arcade's five supported Pokémon Gen 3 ROMs. */
export function identifyArcadeRom(bytes: Uint8Array): GbaRomIdentity | null {
  const gameCode = gbaGameCode(bytes)
  if (!gameCode) return null
  const gameId = gen3GameIdFromCode(gameCode)
  return gameId ? { gameId, gameCode } : null
}

/** Refuses malformed, unsupported, or wrong-game ROM bytes before storage. */
export function assertArcadeRomMatchesGame(
  expected: Gen3GameId,
  bytes: Uint8Array
): GbaRomIdentity {
  const identity = identifyArcadeRom(bytes)
  if (!identity) {
    throw new Error(
      i18n.t('services:gbaRom.thisIsNotASupportedPokeMonRubySapphireEmerald')
    )
  }
  if (identity.gameId !== expected) {
    throw new Error(
      i18n.t('services:gbaRom.thisRomBelongsToNot', {
        gameId: identity.gameId,
        expected: expected,
      })
    )
  }
  return identity
}
