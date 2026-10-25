import type { ExtractOptions, PokedexDataset, PokedexWarning } from './types'
import {
  POKEDEX_EXTRACTOR_VERSION,
  POKEDEX_SCHEMA_VERSION,
  UnsupportedRomError,
} from './types'
import type { Gen3RomHeader } from './rom'
import { decodeGen3Text, readRomPointer } from './rom'
import type { PokedexMoveRef, PokedexSpecies } from './types'
import type { Gen3GameId } from '../saveLibrary'
import speciesData from '../../../vendor/pkhex-wasm/src/ts/gen/data/species.json'
import {
  optionalTables,
  OPTIONAL_ANCHORS,
  type OptionalTables,
} from './tableSources'
import {
  hasMoveTutors,
  readEggMoves,
  readMachineMoves,
  readTutorMoves,
} from './learnsets'
import { readEncounters } from './encounters'
import {
  itemNames,
  readHeldItems,
  readPokedexEntries,
  readProfile,
  regionalNumber,
} from './pokedex'

/** Internal parser interface so each verified table layout can be added safely. */
export interface Gen3RomParser {
  matches(
    bytes: Uint8Array,
    header: Gen3RomHeader,
    options?: ExtractOptions
  ): boolean
  parse(
    bytes: Uint8Array,
    header: Gen3RomHeader,
    romSha256: string,
    metadataFingerprint: string | null,
    options: ExtractOptions
  ): Promise<PokedexDataset>
}

const parsers: Gen3RomParser[] = []

/** Stable base-game tables recorded in the MIT-licensed HexManiac Advance metadata. */
const ENGLISH_REVISION_ZERO = {
  emerald: {
    names: 0x3185c8,
    stats: 0x3203cc,
    moves: 0x31977c,
    abilities: 0x31b6db,
    levelUp: 0x32937c,
    evolutions: 0x32531c,
  },
  firered: {
    names: 0x245ee0,
    stats: 0x254784,
    moves: 0x247094,
    abilities: 0x24fc40,
    levelUp: 0x25d7b4,
    evolutions: 0x259754,
  },
} as const

/** Pointer-source offsets from HexManiac Advance's tableReference.txt. */
const POINTER_SOURCES: Record<
  Gen3GameId,
  Record<
    number,
    {
      names: number
      stats: number
      moves: number
      abilities: number
      levelUp: number
      evolutions: number
    }
  >
> = {
  ruby: {
    0: {
      names: 0xfa58,
      stats: 0x10b64,
      moves: 0x2e18c,
      abilities: 0x9fe64,
      levelUp: 0x3b7bc,
      evolutions: 0x3f534,
    },
    1: {
      names: 0xfa58,
      stats: 0x10b64,
      moves: 0x2e18c,
      abilities: 0x9fe84,
      levelUp: 0x3b7bc,
      evolutions: 0x3f534,
    },
  },
  sapphire: {
    0: {
      names: 0xfa58,
      stats: 0x10b64,
      moves: 0x2e18c,
      abilities: 0x9fe64,
      levelUp: 0x3b7bc,
      evolutions: 0x3f534,
    },
    1: {
      names: 0xfa58,
      stats: 0x10b64,
      moves: 0x2e18c,
      abilities: 0x9fe84,
      levelUp: 0x3b7bc,
      evolutions: 0x3f534,
    },
  },
  emerald: {
    0: {
      names: 0x144,
      stats: 0x1bc,
      moves: 0x148,
      abilities: 0x1c0,
      levelUp: 0x6930c,
      evolutions: 0x6d140,
    },
  },
  firered: {
    0: {
      names: 0x144,
      stats: 0x1bc,
      moves: 0x148,
      abilities: 0x1c0,
      levelUp: 0x3ea7c,
      evolutions: 0x42f6c,
    },
    1: {
      names: 0x144,
      stats: 0x1bc,
      moves: 0x148,
      abilities: 0x1c0,
      levelUp: 0x3ea90,
      evolutions: 0x42f80,
    },
  },
  leafgreen: {
    0: {
      names: 0x144,
      stats: 0x1bc,
      moves: 0x148,
      abilities: 0x1c0,
      levelUp: 0x3ea7c,
      evolutions: 0x42f6c,
    },
    1: {
      names: 0x144,
      stats: 0x1bc,
      moves: 0x148,
      abilities: 0x1c0,
      levelUp: 0x3ea90,
      evolutions: 0x42f80,
    },
  },
}

type Tables = OptionalTables & {
  names: number
  stats: number
  moves: number
  abilities: number
  levelUp: number
  evolutions: number
}

function metadataTables(metadata?: string): Partial<Tables> {
  if (!metadata) return {}
  const anchors: Record<string, keyof Tables> = {
    'data.pokemon.names': 'names',
    'data.pokemon.stats': 'stats',
    'data.pokemon.moves.names': 'moves',
    'data.abilities.names': 'abilities',
    'data.pokemon.moves.levelup': 'levelUp',
    'data.pokemon.evolutions': 'evolutions',
    ...OPTIONAL_ANCHORS,
  }
  const result: Partial<Tables> = {}
  for (const block of metadata.split(/\[\[NamedAnchors\]\]/).slice(1)) {
    const name = block.match(/\bName\s*=\s*'''([^']+)'''/)?.[1]
    const address = block.match(/\bAddress\s*=\s*(0x[0-9a-f]+|\d+)/i)?.[1]
    const key = name ? anchors[name] : undefined
    if (!key || !address) continue
    result[key] = Number(address)
  }
  return result
}

function tablesFor(
  bytes: Uint8Array,
  header: Gen3RomHeader,
  metadata?: string
): Tables | null {
  if (!header.code.endsWith('E') && !metadata) return null
  const fixed =
    header.revision === 0
      ? ENGLISH_REVISION_ZERO[
          header.gameId as keyof typeof ENGLISH_REVISION_ZERO
        ]
      : undefined
  const overrides = metadataTables(metadata)
  const sources = POINTER_SOURCES[header.gameId][header.revision]
  const pointerTables: Partial<Tables> | undefined = sources
    ? Object.fromEntries(
        Object.entries(sources).flatMap(([key, address]) => {
          const target = readRomPointer(bytes, address)
          return target === null ? [] : [[key, target]]
        })
      )
    : undefined
  const base = fixed ?? pointerTables ?? null
  if (!base && Object.keys(overrides).length < 6) return null
  const candidate = {
    ...(base ?? {}),
    ...optionalTables(bytes, header),
    ...overrides,
  }
  if (
    candidate.names === undefined ||
    candidate.stats === undefined ||
    candidate.moves === undefined ||
    candidate.abilities === undefined ||
    typeof candidate.levelUp !== 'number' ||
    typeof candidate.evolutions !== 'number'
  )
    return null
  return candidate as Tables
}

const NATIONAL_BY_NAME = new Map(
  (speciesData as { name: string; nationalDex: number }[]).map(
    ({ name, nationalDex }) => [normalize(name), nationalDex]
  )
)

function normalize(value: string): string {
  const gender = value.includes('♀')
    ? 'female'
    : value.includes('♂')
      ? 'male'
      : ''
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '') + gender
}

const TYPES = [
  'Normal',
  'Fighting',
  'Flying',
  'Poison',
  'Ground',
  'Rock',
  'Bug',
  'Ghost',
  'Steel',
  '???',
  'Fire',
  'Water',
  'Grass',
  'Electric',
  'Psychic',
  'Ice',
  'Dragon',
  'Dark',
]
const EGG_GROUPS = [
  'Undiscovered',
  'Monster',
  'Water 1',
  'Bug',
  'Flying',
  'Field',
  'Fairy',
  'Grass',
  'Human-Like',
  'Water 3',
  'Mineral',
  'Amorphous',
  'Water 2',
  'Ditto',
  'Dragon',
  'Undiscovered',
]
const EVOLUTION_METHODS: Record<number, string> = {
  1: 'friendship',
  2: 'friendship-day',
  3: 'friendship-night',
  4: 'level',
  5: 'trade',
  6: 'trade-item',
  7: 'item',
  8: 'level-atk-greater-def',
  9: 'level-atk-equal-def',
  10: 'level-atk-less-def',
  11: 'level-personality-low',
  12: 'level-personality-high',
  13: 'level',
  14: 'level-extra-species',
  15: 'beauty',
}

function tableName(
  bytes: Uint8Array,
  table: number,
  index: number,
  size: number
): string {
  const start = table + index * size
  return start + size <= bytes.length
    ? decodeGen3Text(bytes.subarray(start, start + size))
    : ''
}

function readLearnset(
  bytes: Uint8Array,
  pointerTable: number,
  speciesId: number,
  moveName: (id: number) => string
): { level: number; move: PokedexMoveRef }[] | null {
  const start = readRomPointer(bytes, pointerTable + speciesId * 4)
  if (start === null) return null
  const result: { level: number; move: PokedexMoveRef }[] = []
  let terminated = false
  for (
    let offset = start;
    offset + 2 <= bytes.length && result.length < 128;
    offset += 2
  ) {
    const packed = bytes[offset] | (bytes[offset + 1] << 8)
    if (packed === 0xffff) {
      terminated = true
      break
    }
    const moveId = packed & 0x1ff
    const level = packed >> 9
    if (moveId === 0) continue
    result.push({
      level,
      move: {
        romId: moveId,
        nationalMoveId: moveId <= 354 ? moveId : null,
        romName: moveName(moveId) || null,
      },
    })
  }
  // An unterminated list ran into unrelated data.
  return terminated ? result : null
}

const vanillaParser: Gen3RomParser = {
  matches(bytes, header, options) {
    const anchors = tablesFor(bytes, header, options?.metadata)
    if (!anchors) return false
    if (
      anchors.names + 412 * 11 > bytes.length ||
      anchors.stats + 412 * 28 > bytes.length
    )
      return false
    if (
      anchors.moves + 355 * 13 > bytes.length ||
      anchors.abilities + 78 * 13 > bytes.length ||
      anchors.levelUp + 412 * 4 > bytes.length ||
      anchors.evolutions + 412 * 40 > bytes.length
    )
      return false
    const bulbasaurId = Array.from({ length: 412 }, (_, id) => id).find(
      (id) => normalize(tableName(bytes, anchors.names, id, 11)) === 'bulbasaur'
    )
    if (bulbasaurId === undefined) return false
    const stats = anchors.stats + bulbasaurId * 28
    return (
      bytes[stats] === 45 && bytes[stats + 1] === 49 && bytes[stats + 2] === 49
    )
  },
  async parse(bytes, header, romSha256, metadataFingerprint, options) {
    const anchors = tablesFor(bytes, header, options.metadata)
    if (!anchors)
      throw new Error('ROM table metadata is missing required Pokédex anchors.')
    const names = Array.from({ length: 412 }, (_, id) =>
      tableName(bytes, anchors.names, id, 11)
    )
    const nationalByRomId = names.map((name) =>
      NATIONAL_BY_NAME.get(normalize(name))
    )
    const moveName = (id: number) => tableName(bytes, anchors.moves, id, 13)
    const abilityName = (id: number) =>
      tableName(bytes, anchors.abilities, id, 13)
    const result: Record<number, PokedexSpecies> = {}
    // Warnings report data the ROM failed to yield. Features not extracted
    // yet (static encounters, gifts, trades, special moves) are not warnings.
    const warnings: PokedexWarning[] = []
    let levelUpPartial = false
    const itemName = itemNames(bytes, anchors.items)
    const moveRef = (id: number): PokedexMoveRef => ({
      romId: id,
      nationalMoveId: id > 0 && id <= 354 ? id : null,
      romName: moveName(id) || null,
    })
    const eggMoves = readEggMoves(bytes, anchors.egg, moveRef)
    const machineMoves = readMachineMoves(
      bytes,
      anchors.machines,
      anchors.machineCompatibility,
      header.gameId,
      moveRef
    )
    const tutorMoves = readTutorMoves(
      bytes,
      anchors.tutors,
      anchors.tutorCompatibility,
      header.gameId,
      moveRef
    )
    for (const [detail, table] of [
      ['egg-moves', eggMoves],
      ['tm-hm-moves', machineMoves],
      // Ruby and Sapphire have no tutors; that is not missing data.
      ...(hasMoveTutors(header.gameId)
        ? ([['tutor-moves', tutorMoves]] as const)
        : []),
    ] as const) {
      if (table.status !== 'available')
        warnings.push({ code: 'unsupported-table', detail })
    }

    for (let romSpeciesId = 1; romSpeciesId < names.length; romSpeciesId++) {
      const name = names[romSpeciesId].trim()
      // Unused slots (vanilla 252-276) are named "?"; they are not species.
      if (!normalize(name)) continue
      const nationalDexNumber = nationalByRomId[romSpeciesId]
      if (nationalDexNumber === undefined) {
        warnings.push({
          code: 'unmapped-species',
          detail: String(romSpeciesId),
        })
        continue
      }
      const offset = anchors.stats + romSpeciesId * 28
      if (offset + 28 > bytes.length) break
      const row = bytes.subarray(offset, offset + 28)
      const evBits = row[10] | (row[11] << 8)
      const levelUp = readLearnset(
        bytes,
        anchors.levelUp,
        romSpeciesId,
        moveName
      )
      if (!levelUp) {
        levelUpPartial = true
        warnings.push({
          code: 'partial-data',
          detail: `level-up-moves-${romSpeciesId}`,
        })
      }
      const current: PokedexSpecies = {
        nationalDexNumber,
        romSpeciesIds: [romSpeciesId],
        name,
        stats: {
          hp: row[0],
          attack: row[1],
          defense: row[2],
          speed: row[3],
          specialAttack: row[4],
          specialDefense: row[5],
        },
        types: [...new Set([TYPES[row[6]] ?? '???', TYPES[row[7]] ?? '???'])],
        catchRate: row[8],
        baseExperience: row[9],
        evYield: {
          hp: evBits & 3,
          attack: (evBits >> 2) & 3,
          defense: (evBits >> 4) & 3,
          speed: (evBits >> 6) & 3,
          specialAttack: (evBits >> 8) & 3,
          specialDefense: (evBits >> 10) & 3,
        },
        abilities: [
          ...new Set(
            [row[22], row[23]]
              .filter((id) => id !== 0)
              .map(abilityName)
              .filter(Boolean)
          ),
        ],
        breeding: {
          eggGroups: [
            ...new Set(
              [EGG_GROUPS[row[20]], EGG_GROUPS[row[21]]].filter(
                (group) => group && group !== 'Undiscovered'
              )
            ),
          ],
          genderRatio: row[16],
          hatchCycles: row[17],
        },
        profile: readProfile(row),
        heldItems: readHeldItems(row, itemName),
        learnsets: {
          levelUp: levelUp ?? [],
          egg: eggMoves.moves.get(romSpeciesId) ?? [],
          tmHm: machineMoves.moves.get(romSpeciesId) ?? [],
          tutor: tutorMoves.moves.get(romSpeciesId) ?? [],
        },
        evolutions: { from: [], to: [] },
        pokedex: {
          category: null,
          flavorText: [],
          height: null,
          weight: null,
          regionalNumber: regionalNumber(
            bytes,
            anchors.regionalDex,
            header.gameId,
            romSpeciesId,
            nationalDexNumber
          ),
        },
        encounters: [],
      }
      const existing = result[nationalDexNumber]
      if (existing) {
        if (JSON.stringify(existing.stats) !== JSON.stringify(current.stats)) {
          warnings.push({
            code: 'unmapped-species',
            detail: `conflicting-national-dex-${nationalDexNumber}`,
          })
        } else existing.romSpeciesIds.push(romSpeciesId)
      } else result[nationalDexNumber] = current
    }

    for (let romSpeciesId = 1; romSpeciesId < names.length; romSpeciesId++) {
      const nationalDexNumber = nationalByRomId[romSpeciesId]
      if (nationalDexNumber === undefined) continue
      const owner = result[nationalDexNumber]
      if (!owner || owner.romSpeciesIds[0] !== romSpeciesId) continue
      // Each HMA evolution slot has three u16 fields and two padding bytes.
      const start = anchors.evolutions + romSpeciesId * 5 * 8
      for (let index = 0; index < 5; index++) {
        const offset = start + index * 8
        if (offset + 6 > bytes.length) break
        const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 6)
        const methodId = view.getUint16(0, true)
        const parameter = view.getUint16(2, true)
        const targetRomId = view.getUint16(4, true)
        if (methodId === 0 || targetRomId === 0) continue
        const targetNationalDex = nationalByRomId[targetRomId]
        const method =
          methodId === 14 &&
          header.gameId !== 'ruby' &&
          header.gameId !== 'sapphire'
            ? 'level-extra-species-ball'
            : EVOLUTION_METHODS[methodId]
        if (targetNationalDex === undefined || !method) {
          warnings.push({
            code: 'partial-data',
            detail: `unresolved-evolution-${romSpeciesId}-${index}`,
          })
          continue
        }
        const resolvedParameter = [1, 2, 3, 5].includes(methodId)
          ? null
          : parameter
        owner.evolutions.to.push({
          nationalDexNumber: targetNationalDex,
          method,
          parameter: resolvedParameter,
        })
      }
    }
    const pokedex = readPokedexEntries(
      bytes,
      anchors.pokedexStats,
      header.gameId,
      Object.values(result).map((species) => species.nationalDexNumber)
    )
    for (const [national, entry] of pokedex.entries)
      Object.assign(result[national].pokedex, entry)
    if (pokedex.status !== 'available')
      warnings.push({ code: 'unsupported-table', detail: 'pokedex' })
    if (!itemName) warnings.push({ code: 'unsupported-table', detail: 'items' })

    for (const source of Object.values(result)) {
      for (const evolution of source.evolutions.to) {
        result[evolution.nationalDexNumber]?.evolutions.from.push(
          source.nationalDexNumber
        )
      }
    }
    const encounters = readEncounters(
      bytes,
      anchors,
      header,
      nationalByRomId,
      result,
      warnings
    )
    if (encounters.status === 'unavailable')
      warnings.push({ code: 'unsupported-table', detail: 'wild-encounters' })

    return {
      schemaVersion: 0,
      extractorVersion: '',
      game: { ...header, id: header.gameId },
      romSha256,
      metadataFingerprint,
      species: result,
      locations: encounters.locations,
      warnings,
      capabilities: {
        identity: 'available',
        stats: 'available',
        learnsets: 'partial',
        levelUp: levelUpPartial ? 'partial' : 'available',
        eggMoves: eggMoves.status,
        tmHm: machineMoves.status,
        tutorMoves: tutorMoves.status,
        evolutions: 'available',
        pokedex: pokedex.status,
        heldItems: itemName ? 'available' : 'partial',
        encounters: encounters.status,
      },
    }
  },
}

registerGen3RomParser(vanillaParser)

export function registerGen3RomParser(parser: Gen3RomParser): void {
  parsers.unshift(parser)
}

export async function extractKnownRom(
  bytes: Uint8Array,
  header: Gen3RomHeader,
  romSha256: string,
  metadataFingerprint: string | null,
  options: ExtractOptions
): Promise<PokedexDataset> {
  const parser = parsers.find((candidate) =>
    candidate.matches(bytes, header, options)
  )
  if (!parser) {
    throw new UnsupportedRomError(
      `No verified table layout is registered for ${header.title} revision ${header.revision}.`
    )
  }
  const dataset = await parser.parse(
    bytes,
    header,
    romSha256,
    metadataFingerprint,
    options
  )
  return {
    ...dataset,
    schemaVersion: POKEDEX_SCHEMA_VERSION,
    extractorVersion: POKEDEX_EXTRACTOR_VERSION,
    romSha256,
    metadataFingerprint,
  }
}
