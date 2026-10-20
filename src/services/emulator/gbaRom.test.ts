import { describe, expect, it } from 'vitest'
import {
  assertArcadeRomMatchesGame,
  gbaGameCode,
  identifyArcadeRom,
} from './gbaRom'

function rom(code: string): Uint8Array {
  const bytes = new Uint8Array(192)
  bytes.set(
    [...code].map((character) => character.charCodeAt(0)),
    0xac
  )
  return bytes
}

describe('Arcade GBA ROM identity', () => {
  it('reads regional game codes and identifies all five games', () => {
    expect(identifyArcadeRom(rom('AXVE'))?.gameId).toBe('ruby')
    expect(identifyArcadeRom(rom('AXPJ'))?.gameId).toBe('sapphire')
    expect(identifyArcadeRom(rom('BPEF'))?.gameId).toBe('emerald')
    expect(identifyArcadeRom(rom('BPRD'))?.gameId).toBe('firered')
    expect(identifyArcadeRom(rom('BPGS'))?.gameId).toBe('leafgreen')
  })

  it('rejects short, malformed, unsupported, and wrong-game ROMs', () => {
    expect(gbaGameCode(new Uint8Array(191))).toBeNull()
    expect(identifyArcadeRom(rom('bad!'))).toBeNull()
    expect(identifyArcadeRom(rom('AGBE'))).toBeNull()
    expect(() => assertArcadeRomMatchesGame('ruby', rom('BPEE'))).toThrow(
      'not ruby'
    )
    expect(() => assertArcadeRomMatchesGame('ruby', new Uint8Array(1))).toThrow(
      'not a supported Pokémon'
    )
  })

  it('returns the validated header identity', () => {
    expect(assertArcadeRomMatchesGame('emerald', rom('BPEE'))).toEqual({
      gameId: 'emerald',
      gameCode: 'BPEE',
    })
  })
})
