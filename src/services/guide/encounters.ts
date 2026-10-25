import type { Gen3RomHeader } from './rom'
import { decodeGen3Text, readRomPointer } from './rom'
import type { OptionalTables } from './tableSources'
import type {
  PokedexDataset,
  PokedexEncounter,
  PokedexSpecies,
  PokedexWarning,
} from './types'

const LAND = [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1]
const WATER_ROCK = [60, 30, 5, 4, 1]
const FISH = [70, 30, 60, 20, 20, 40, 40, 15, 4, 1]

function mapName(
  bytes: Uint8Array,
  tables: OptionalTables,
  header: Gen3RomHeader,
  bank: number,
  map: number
): string | null {
  if (tables.mapBanks === undefined || tables.mapNames === undefined)
    return null
  const maps = readRomPointer(bytes, tables.mapBanks + bank * 4)
  const mapHeader = maps === null ? null : readRomPointer(bytes, maps + map * 4)
  if (mapHeader === null || mapHeader + 21 > bytes.length) return null
  const section = bytes[mapHeader + 20]
  const kanto = header.gameId === 'firered' || header.gameId === 'leafgreen'
  const index = section - (kanto ? 88 : 0)
  if (index < 0 || index > 255) return null
  const namePointer = readRomPointer(
    bytes,
    tables.mapNames + index * (kanto ? 4 : 8) + (kanto ? 0 : 4)
  )
  if (namePointer === null) return null
  const name = decodeGen3Text(
    bytes.subarray(namePointer, Math.min(namePointer + 128, bytes.length))
  )
  return name && !name.includes('�') ? name : null
}

/** Read ordinary wild tables. Slot weights are conditional encounter chances. */
export function readEncounters(
  bytes: Uint8Array,
  tables: OptionalTables,
  header: Gen3RomHeader,
  nationalByRomId: (number | undefined)[],
  species: Record<number, PokedexSpecies>,
  warnings: PokedexWarning[]
): {
  status: PokedexDataset['capabilities'][string]
  locations: Record<string, number[]>
} {
  const locations: Record<string, number[]> = {}
  if (
    tables.wild === undefined ||
    tables.wild < 0 ||
    tables.wild + 20 > bytes.length
  )
    return { status: 'unavailable', locations }
  const records = new Map<
    string,
    { speciesId: number; encounter: PokedexEncounter; weight: number }
  >()
  const variants = new Map<string, number>()
  let terminated = false
  let partial = false
  let headers = 0
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let row = 0; row < 2048; row++) {
    const offset = tables.wild + row * 20
    if (offset + 20 > bytes.length) break
    const bank = bytes[offset]
    const map = bytes[offset + 1]
    if (bank === 0xff && map === 0xff) {
      terminated = true
      break
    }
    const mapId = `${bank}.${map}`
    const variant = variants.get(mapId) ?? 0
    variants.set(mapId, variant + 1)
    const name = mapName(bytes, tables, header, bank, map)
    const conditions = variant ? [`alternate-encounter-table:${variant}`] : []
    let validHeader = false
    for (let kind = 0; kind < 4; kind++) {
      const source = offset + 4 + kind * 4
      if (view.getUint32(source, true) === 0) continue
      const info = readRomPointer(bytes, source)
      if (info === null || info + 8 > bytes.length) {
        partial = true
        continue
      }
      const encounterRate = view.getUint32(info, true)
      const slots = readRomPointer(bytes, info + 4)
      const weights = kind === 0 ? LAND : kind === 3 ? FISH : WATER_ROCK
      if (
        encounterRate > 255 ||
        slots === null ||
        slots + weights.length * 4 > bytes.length
      ) {
        partial = true
        continue
      }
      validHeader = true
      if (encounterRate === 0) continue
      if (!name) partial = true
      for (let slot = 0; slot < weights.length; slot++) {
        const position = slots + slot * 4
        const minLevel = bytes[position]
        const maxLevel = bytes[position + 1]
        const romId = view.getUint16(position + 2, true)
        const national = nationalByRomId[romId]
        if (
          national === undefined ||
          !species[national] ||
          minLevel < 1 ||
          maxLevel > 100 ||
          minLevel > maxLevel
        ) {
          partial = true
          continue
        }
        const method =
          kind === 0
            ? 'grass'
            : kind === 1
              ? 'surf'
              : kind === 2
                ? 'rock-smash'
                : slot < 2
                  ? 'old-rod'
                  : slot < 5
                    ? 'good-rod'
                    : 'super-rod'
        const key = `${mapId}:${variant}:${method}:${national}:${encounterRate}`
        const existing = records.get(key)
        if (existing) {
          existing.weight += weights[slot]
          existing.encounter.minLevel = Math.min(
            existing.encounter.minLevel,
            minLevel
          )
          existing.encounter.maxLevel = Math.max(
            existing.encounter.maxLevel,
            maxLevel
          )
        } else
          records.set(key, {
            speciesId: national,
            weight: weights[slot],
            encounter: {
              mapId,
              mapName: name ?? '',
              method,
              minLevel,
              maxLevel,
              encounterRate,
              probability: null,
              ...(conditions.length ? { conditions } : {}),
            },
          })
      }
    }
    if (validHeader) headers++
    else partial = true
  }
  if (!headers && !terminated) return { status: 'unavailable', locations }
  for (const { speciesId, encounter, weight } of records.values()) {
    encounter.probability = weight / 100
    species[speciesId].encounters.push(encounter)
    const index = (locations[encounter.mapId] ??= [])
    if (!index.includes(speciesId)) index.push(speciesId)
  }
  for (const ids of Object.values(locations)) ids.sort((a, b) => a - b)
  if (partial || !terminated)
    warnings.push({ code: 'partial-data', detail: 'wild-encounters' })
  return { status: partial || !terminated ? 'partial' : 'available', locations }
}
