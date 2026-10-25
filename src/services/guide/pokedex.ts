import type { Gen3GameId } from '../saveLibrary'
import { decodeGen3Text, readRomPointer } from './rom'
import type { PokedexDataset, PokedexSpecies } from './types'

type Availability = PokedexDataset['capabilities'][string]
type PokedexEntry = Omit<PokedexSpecies['pokedex'], 'regionalNumber'>

export interface PokedexEntryTable {
  entries: Map<number, PokedexEntry>
  status: Availability
}

/** Longest entry text read per page; vanilla pages are well under this. */
const MAX_TEXT = 512

/**
 * Pokédex entries are indexed by National Dex number. Ruby/Sapphire and
 * FireRed/LeafGreen rows are 36 bytes with two text pointers (two pages in
 * R/S; FR/LG leaves the second unused); Emerald rows are 32 bytes with one.
 */
export function readPokedexEntries(
  bytes: Uint8Array,
  start: number | undefined,
  gameId: Gen3GameId,
  nationalDexNumbers: Iterable<number>
): PokedexEntryTable {
  const entries = new Map<number, PokedexEntry>()
  if (start === undefined) return { entries, status: 'unavailable' }
  const stride = gameId === 'emerald' ? 32 : 36
  const pages =
    gameId === 'ruby' || gameId === 'sapphire' ? [0x10, 0x14] : [0x10]
  let partial = false
  for (const national of nationalDexNumbers) {
    const offset = start + national * stride
    if (offset + stride > bytes.length) {
      partial = true
      continue
    }
    const category = decodeGen3Text(bytes.subarray(offset, offset + 12))
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, stride)
    const height = view.getUint16(0x0c, true)
    const weight = view.getUint16(0x0e, true)
    const flavorText = pages.flatMap((page) => {
      const text = readRomPointer(bytes, offset + page)
      return text === null
        ? []
        : [decodeGen3Text(bytes.subarray(text, text + MAX_TEXT))]
    })
    if (!category || !height || !weight || flavorText.length !== pages.length) {
      partial = true
      continue
    }
    entries.set(national, {
      category,
      flavorText: flavorText.filter(Boolean),
      height,
      weight,
    })
  }
  return {
    entries,
    status: !entries.size ? 'unavailable' : partial ? 'partial' : 'available',
  }
}

const ITEM_STRIDE = 44

/**
 * Item rows are 44 bytes: a 14-byte name, then the item's own index. The
 * index must match the row for the first items, or the table is not trusted.
 */
export function itemNames(
  bytes: Uint8Array,
  start: number | undefined
): ((id: number) => string | null) | null {
  if (start === undefined) return null
  for (let id = 1; id <= 10; id++) {
    const offset = start + id * ITEM_STRIDE
    if (offset + ITEM_STRIDE > bytes.length) return null
    if ((bytes[offset + 14] | (bytes[offset + 15] << 8)) !== id) return null
  }
  return (id) => {
    const offset = start + id * ITEM_STRIDE
    if (offset + ITEM_STRIDE > bytes.length) return null
    return decodeGen3Text(bytes.subarray(offset, offset + 14)) || null
  }
}

/** Wild held items from a base-stats row: 50% / 5%, or always when both match. */
export function readHeldItems(
  row: Uint8Array,
  itemName: ((id: number) => string | null) | null
): PokedexSpecies['heldItems'] {
  const common = row[12] | (row[13] << 8)
  const rare = row[14] | (row[15] << 8)
  const held = (itemId: number, probability: number) => ({
    itemId,
    name: itemName?.(itemId) ?? null,
    probability,
  })
  if (common && common === rare) return [held(common, 1)]
  return [
    ...(common ? [held(common, 0.5)] : []),
    ...(rare ? [held(rare, 0.05)] : []),
  ]
}

const GROWTH_RATES = [
  'medium-fast',
  'erratic',
  'fluctuating',
  'medium-slow',
  'fast',
  'slow',
]
const COLORS = [
  'red',
  'blue',
  'yellow',
  'green',
  'black',
  'brown',
  'purple',
  'gray',
  'white',
  'pink',
]

/** Base-stat bytes 18, 19, 24 and 25 (low seven bits; the top bit is no-flip). */
export function readProfile(row: Uint8Array): PokedexSpecies['profile'] {
  return {
    baseFriendship: row[18],
    growthRate: GROWTH_RATES[row[19]] ?? 'unknown',
    safariFleeRate: row[24],
    color: COLORS[row[25] & 0x7f] ?? 'unknown',
  }
}

/** Hoenn Dex has 202 entries; Kanto Dex is National Dex 1-151. */
const HOENN_DEX_COUNT = 202
const KANTO_DEX_COUNT = 151

/**
 * The species' number in the game's regional Pokédex. Ruby, Sapphire and
 * Emerald read the Hoenn order table (indexed by ROM species ID - 1).
 */
export function regionalNumber(
  bytes: Uint8Array,
  regionalTable: number | undefined,
  gameId: Gen3GameId,
  romSpeciesId: number,
  nationalDexNumber: number
): number | null {
  if (gameId === 'firered' || gameId === 'leafgreen')
    return nationalDexNumber <= KANTO_DEX_COUNT ? nationalDexNumber : null
  if (regionalTable === undefined) return null
  const offset = regionalTable + (romSpeciesId - 1) * 2
  if (offset + 2 > bytes.length) return null
  const value = bytes[offset] | (bytes[offset + 1] << 8)
  return value > 0 && value <= HOENN_DEX_COUNT ? value : null
}
