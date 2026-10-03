import type { Generation } from '../../services/saveLibrary'

export const CAMPING_POKEMON_BOX_SIZE = 30
export const DEFAULT_CAMPING_BOX_COUNT = 10
export const MIN_CAMPING_BOX_COUNT = 1

const STORAGE_KEY_PREFIX = 'pkcamp:camping-box-count:gen-'

function normalizeBoxCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < MIN_CAMPING_BOX_COUNT) {
    return DEFAULT_CAMPING_BOX_COUNT
  }
  return value
}

export function getStoredCampingBoxCount(generation: Generation): number {
  if (typeof localStorage === 'undefined') return DEFAULT_CAMPING_BOX_COUNT
  const stored = Number.parseInt(
    localStorage.getItem(`${STORAGE_KEY_PREFIX}${generation}`) ?? '',
    10
  )
  return normalizeBoxCount(stored)
}

export function setStoredCampingBoxCount(
  generation: Generation,
  boxCount: number
): void {
  localStorage.setItem(
    `${STORAGE_KEY_PREFIX}${generation}`,
    String(normalizeBoxCount(boxCount))
  )
}

export function minimumCampingBoxCount(itemCount: number): number {
  return Math.max(
    MIN_CAMPING_BOX_COUNT,
    Math.ceil(Math.max(0, itemCount) / CAMPING_POKEMON_BOX_SIZE)
  )
}

export function resizeCampingSlots<T>(
  slots: readonly (T | null)[],
  requestedBoxCount: number
): (T | null)[] {
  const occupied = slots.filter((slot): slot is T => slot !== null)
  const boxCount = Math.max(
    normalizeBoxCount(requestedBoxCount),
    minimumCampingBoxCount(occupied.length)
  )
  const capacity = boxCount * CAMPING_POKEMON_BOX_SIZE
  const resized = slots.slice(0, capacity)
  while (resized.length < capacity) resized.push(null)

  const overflow = slots
    .slice(capacity)
    .filter((slot): slot is T => slot !== null)
  for (const item of overflow) {
    const emptySlot = resized.indexOf(null)
    if (emptySlot < 0) break
    resized[emptySlot] = item
  }

  return resized
}
