import type { Gen3GameId } from '../saveLibrary'
import type { PokedexDataset, PokedexMoveRef } from './types'

type Availability = PokedexDataset['capabilities'][string]
type MoveFactory = (id: number) => PokedexMoveRef
export interface MoveTableResult {
  moves: Map<number, PokedexMoveRef[]>
  status: Availability
}

/** Gen III egg streams use species + 20000 markers and a 0xFFFF terminator. */
export function readEggMoves(
  bytes: Uint8Array,
  start: number | undefined,
  move: MoveFactory
): MoveTableResult {
  const moves = new Map<number, PokedexMoveRef[]>()
  if (start === undefined || start < 0 || start + 2 > bytes.length)
    return { moves, status: 'unavailable' }
  let current: PokedexMoveRef[] | null = null
  let partial = false
  let terminated = false
  for (
    let offset = start;
    offset + 2 <= bytes.length && offset < start + 16384;
    offset += 2
  ) {
    const value = bytes[offset] | (bytes[offset + 1] << 8)
    if (value === 0xffff) {
      terminated = true
      break
    }
    if (value >= 20000) {
      const speciesId = value - 20000
      current = speciesId > 0 && speciesId < 412 ? [] : null
      if (current) moves.set(speciesId, current)
      else partial = true
    } else if (value > 0 && current) {
      const entry = move(value)
      if (!entry.romName) partial = true
      if (!current.some((known) => known.romId === value)) current.push(entry)
    } else partial = true
  }
  return {
    moves,
    status: !moves.size
      ? 'unavailable'
      : terminated && !partial
        ? 'available'
        : 'partial',
  }
}

/** Compatibility is a little-endian 58-bit mask in an eight-byte species row. */
export function readMachineMoves(
  bytes: Uint8Array,
  dictionary: number | undefined,
  compatibility: number | undefined,
  gameId: Gen3GameId,
  move: MoveFactory
): MoveTableResult {
  const moves = new Map<number, PokedexMoveRef[]>()
  if (
    dictionary === undefined ||
    compatibility === undefined ||
    dictionary < 0 ||
    compatibility < 0 ||
    dictionary + 58 * 2 > bytes.length ||
    compatibility + 412 * 8 > bytes.length
  )
    return { moves, status: 'unavailable' }
  // FR/LG retain Dive in the ROM dictionary, but have only seven obtainable HMs.
  const count = gameId === 'firered' || gameId === 'leafgreen' ? 57 : 58
  const entries: (PokedexMoveRef | null)[] = []
  let partial = false
  for (let slot = 0; slot < count; slot++) {
    const id =
      bytes[dictionary + slot * 2] | (bytes[dictionary + slot * 2 + 1] << 8)
    if (id === 0 || id === 0xffff) {
      entries.push(null)
      partial = true
      continue
    }
    const entry = move(id)
    if (!entry.romName) partial = true
    entries.push({
      ...entry,
      machine: {
        kind: slot < 50 ? 'tm' : 'hm',
        number: slot < 50 ? slot + 1 : slot - 49,
      },
    })
  }
  if (entries.every((entry) => !entry)) return { moves, status: 'unavailable' }
  for (let speciesId = 1; speciesId < 412; speciesId++) {
    const learned: PokedexMoveRef[] = []
    for (let slot = 0; slot < count; slot++) {
      if (
        bytes[compatibility + speciesId * 8 + (slot >> 3)] &
          (1 << (slot & 7)) &&
        entries[slot]
      )
        learned.push(entries[slot]!)
    }
    moves.set(speciesId, learned)
  }
  return { moves, status: partial ? 'partial' : 'available' }
}
