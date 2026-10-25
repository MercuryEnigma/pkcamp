import type { Gen3GameId } from '../saveLibrary'
import { gen3GameIdFromCode } from '../saveLibrary'

const GAME_CODE_OFFSET = 0xac

const TITLES: Record<Gen3GameId, string> = {
  ruby: 'Pokémon Ruby',
  sapphire: 'Pokémon Sapphire',
  emerald: 'Pokémon Emerald',
  firered: 'Pokémon FireRed',
  leafgreen: 'Pokémon LeafGreen',
}

export interface Gen3RomHeader {
  gameId: Gen3GameId
  code: string
  title: string
  revision: number
  isRomHack: boolean | null
}

export function readGen3RomHeader(bytes: Uint8Array): Gen3RomHeader | null {
  if (bytes.length < 0xc0) return null
  const code = String.fromCharCode(
    ...bytes.subarray(GAME_CODE_OFFSET, GAME_CODE_OFFSET + 4)
  )
  if (!/^[A-Z0-9]{4}$/.test(code)) return null
  const gameId = gen3GameIdFromCode(code)
  if (!gameId) return null
  return {
    gameId,
    title: TITLES[gameId],
    code,
    revision: bytes[0xbc] ?? 0,
    // A retained stock game code does not prove a ROM is unmodified. A
    // parser may refine this after checking revision-specific signatures.
    isRomHack: null,
  }
}

/** Read a little-endian GBA pointer, converting its 0x08xxxxxx bus address. */
export function readRomPointer(
  bytes: Uint8Array,
  offset: number
): number | null {
  if (!Number.isInteger(offset) || offset < 0 || offset + 4 > bytes.length)
    return null
  const pointer = new DataView(
    bytes.buffer,
    bytes.byteOffset + offset,
    4
  ).getUint32(0, true)
  if ((pointer & 0xff000000) !== 0x08000000) return null
  const target = pointer & 0x01ffffff
  return target < bytes.length ? target : null
}

/** Decode the common Gen III character set for printable text and names. */
export function decodeGen3Text(
  bytes: Uint8Array,
  maxLength = bytes.length
): string {
  const specials: Record<number, string> = {
    0x01: 'À',
    0x02: 'Á',
    0x03: 'Â',
    0x04: 'Ç',
    0x05: 'È',
    0x06: 'É',
    0x07: 'Ê',
    0x08: 'Ë',
    0x09: 'Ì',
    0x0b: 'Î',
    0x0c: 'Ï',
    0x0d: 'Ò',
    0x0e: 'Ó',
    0x0f: 'Ô',
    0x10: 'Œ',
    0x11: 'Ù',
    0x12: 'Ú',
    0x13: 'Û',
    0x14: 'Ñ',
    0x15: 'ß',
    0x16: 'à',
    0x17: 'á',
    0x19: 'ç',
    0x1a: 'è',
    0x1b: 'é',
    0x1c: 'ê',
    0x1d: 'ë',
    0x1e: 'ì',
    0x20: 'î',
    0x21: 'ï',
    0x22: 'ò',
    0x23: 'ó',
    0x24: 'ô',
    0x25: 'œ',
    0x26: 'ù',
    0x27: 'ú',
    0x28: 'û',
    0x29: 'ñ',
    0x2a: 'º',
    0x2b: 'ª',
    0x5a: 'Í',
    0x68: 'â',
    0x6f: 'í',
    0xb0: '…',
    0xb1: '“',
    0xb2: '”',
    0xb3: '‘',
    0xb4: "'",
    0xb5: '♂',
    0xb6: '♀',
    0xb7: '$',
    0xb8: ',',
    0xb9: '*',
    0xba: '/',
    0xf0: ':',
    0xf1: 'Ä',
    0xf2: 'Ö',
    0xf3: 'Ü',
    0xf4: 'ä',
    0xf5: 'ö',
    0xf6: 'ü',
    0xf7: '?',
  }
  let result = ''
  for (const value of bytes.subarray(0, maxLength)) {
    if (value === 0xff) break
    if (value === 0x00) result += ' '
    else if (specials[value]) result += specials[value]
    else if (value >= 0xbb && value <= 0xd4)
      result += String.fromCharCode(65 + value - 0xbb)
    else if (value >= 0xd5 && value <= 0xee)
      result += String.fromCharCode(97 + value - 0xd5)
    else if (value >= 0xa1 && value <= 0xaa) result += String(value - 0xa1)
    else if (value === 0xab) result += '!'
    else if (value === 0xac) result += '?'
    else if (value === 0xad) result += '.'
    else if (value === 0xae) result += '-'
    else if (value === 0xaf) result += '‧'
    else if (value >= 0xf8 && value <= 0xfe) result += ' '
    else result += '�'
  }
  return result.trim()
}
