/**
 * A minimal in-memory, fixture-driven fake implementation of
 * {@link PokemonSaveBackend}. There is no real forked-WASM backend yet (see
 * the note at the top of adapter.ts); this fake exists to make the adapter's
 * contract testable end-to-end without one.
 *
 * It works by treating the "save bytes" as a lookup key into a small table of
 * canned fixtures, and "pkm bytes" as a JSON-encoded PokemonNode. Real save
 * parsing is entirely out of scope here.
 */

import type { BackendSaveData, PokemonSaveBackend } from './backend.ts'
import type {
  BoxNode,
  NamedRef,
  PartyNode,
  PokemonNode,
  RibbonRef,
  StatSpread,
} from './types.ts'

/**
 * RibbonIndex ids, mirroring the real backend's PKHeX.Core-sourced ids where
 * available. `shortName`/`iconFile` mirror `RibbonDefinition` in
 * `vendor/pkhex-wasm/external/PKHeX.Everywhere/src/PKHeX.Facade/Pokemons/Ribbons.cs`
 * (short name strips Core's generation-disambiguating qualifier; icon file is
 * `lowercase(PropertyName) + ".png"`, served from `public/ribbons/`).
 */
const CHAMPION_RIBBON: RibbonRef = {
  id: 1,
  name: 'Champion (Gen3)',
  shortName: 'Champion',
  iconFile: 'ribbonchampiong3.png',
}
const EFFORT_RIBBON: RibbonRef = {
  id: 7,
  name: 'Effort',
  shortName: 'Effort',
  iconFile: 'ribboneffort.png',
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()
const SERIALIZED_PREFIX = 'mock-save:'

function emptyBox(name: string, size = 30): BoxNode {
  return { name, slots: new Array<null>(size).fill(null) }
}

function emptyParty(size = 6): PartyNode {
  return new Array<null>(size).fill(null)
}

/** Six-stat spread in HP/Atk/Def/SpA/SpD/Spe order. */
function spread(
  hp: number,
  attack: number,
  defense: number,
  specialAttack: number,
  specialDefense: number,
  speed: number
): StatSpread {
  return { hp, attack, defense, specialAttack, specialDefense, speed }
}

const ZERO = spread(0, 0, 0, 0, 0, 0)
const HARDY: NamedRef = { id: 0, name: 'Hardy' }

// Fixture stats follow the standard Gen 3+ formula for 0 IV / 0 EV and a
// neutral nature, so they are internally consistent with the other fields.
const pikachu: PokemonNode = {
  species: 25,
  form: 0,
  level: 12,
  gender: 'Male',
  shiny: false,
  isEgg: false,
  nickname: 'PIKACHU',
  originalTrainerName: 'RED',
  originalTrainerId: 12345,
  originalTrainerSecretId: 54321,
  heldItem: 0,
  heldItemName: '',
  nature: HARDY,
  ability: { id: 9, name: 'Static' },
  moves: [
    { id: 84, name: 'ThunderShock', pp: 30 },
    { id: 45, name: 'Growl', pp: 40 },
    { id: 39, name: 'Tail Whip', pp: 30 },
    { id: 86, name: 'Thunder Wave', pp: 20 },
  ],
  ribbons: [CHAMPION_RIBBON, EFFORT_RIBBON],
  ivs: ZERO,
  evs: ZERO,
  stats: spread(30, 18, 12, 17, 14, 26),
}

const eevee: PokemonNode = {
  species: 133,
  form: 0,
  level: 8,
  gender: 'Female',
  shiny: true,
  isEgg: false,
  nickname: 'EEVEE',
  // A traded Pokemon: its original trainer differs from the save's.
  originalTrainerName: 'BLUE',
  originalTrainerId: 67890,
  originalTrainerSecretId: 22222,
  heldItem: 0,
  heldItemName: '',
  nature: HARDY,
  ability: { id: 50, name: 'Run Away' },
  moves: [
    { id: 33, name: 'Tackle', pp: 35 },
    { id: 39, name: 'Tail Whip', pp: 30 },
    { id: 270, name: 'Helping Hand', pp: 20 },
    null,
  ],
  ribbons: [],
  ivs: ZERO,
  evs: ZERO,
  stats: spread(26, 13, 13, 12, 15, 13),
}

const togepiEgg: PokemonNode = {
  species: 175,
  form: 0,
  level: 1,
  gender: 'Genderless',
  shiny: false,
  isEgg: true,
  nickname: 'Egg',
  originalTrainerName: 'RED',
  originalTrainerId: 12345,
  originalTrainerSecretId: 54321,
  heldItem: 0,
  heldItemName: '',
  nature: HARDY,
  ability: { id: 55, name: 'Hustle' },
  moves: [
    { id: 45, name: 'Growl', pp: 40 },
    { id: 204, name: 'Charm', pp: 20 },
    null,
    null,
  ],
  ribbons: [],
  ivs: ZERO,
  evs: ZERO,
  stats: spread(11, 5, 6, 5, 6, 5),
}

/** Fixture keyed by the marker string encoded in the fake "save bytes". */
const FIXTURES: Record<string, () => BackendSaveData> = {
  'fixture:emerald': () => {
    const boxes = [emptyBox('BOX 1'), emptyBox('BOX 2')]
    boxes[0].slots[0] = eevee
    boxes[0].slots[2] = togepiEgg
    return {
      trainer: { name: 'MAY', id: 12345, secretId: 54321 },
      party: (() => {
        const party = emptyParty()
        party[0] = pikachu
        return party
      })(),
      boxes,
      version: {
        exact: 'Emerald',
        approximateGeneration: 3,
        aggregated: 'Emerald',
      },
    }
  },
  'fixture:gen3-ambiguous': () => ({
    trainer: { name: 'BRENDAN', id: 1, secretId: 2 },
    party: emptyParty(),
    boxes: [emptyBox('BOX 1')],
    // Detection could only narrow this to "some Gen 3 game" — exercises the
    // approximate tier of GameVersionIdentity.
    version: {
      exact: 'Unknown',
      approximateGeneration: 3,
      aggregated: 'Gen 3 (approximate)',
    },
  }),
}

export function encodeFixtureSaveBytes(key: keyof typeof FIXTURES): Uint8Array {
  return textEncoder.encode(key)
}

export function encodePokemonFileBytes(pokemon: PokemonNode): Uint8Array {
  return textEncoder.encode(JSON.stringify(pokemon))
}

export function createMockPokemonSaveBackend(): PokemonSaveBackend {
  const released = new WeakSet<BackendSaveData>()

  return {
    loadSave(bytes: Uint8Array): BackendSaveData {
      const key = textDecoder.decode(bytes)
      if (key.startsWith(SERIALIZED_PREFIX)) {
        return JSON.parse(
          key.slice(SERIALIZED_PREFIX.length)
        ) as BackendSaveData
      }
      const build = FIXTURES[key]
      if (!build) {
        throw new Error(`mock backend: unknown fixture key "${key}"`)
      }
      return build()
    },

    loadPokemonFile(bytes: Uint8Array): PokemonNode {
      const parsed = JSON.parse(textDecoder.decode(bytes)) as PokemonNode
      return parsed
    },

    exportPokemonFile(pokemon: PokemonNode): Uint8Array {
      return encodePokemonFileBytes(pokemon)
    },

    setBoxSlot(): void {
      // The adapter owns the normalized mock data and updates it immediately
      // after this hook. A real backend writes the corresponding native save.
    },

    saveBytes(data: BackendSaveData): Uint8Array {
      return textEncoder.encode(`${SERIALIZED_PREFIX}${JSON.stringify(data)}`)
    },

    releaseSave(data: BackendSaveData): void {
      if (released.has(data)) {
        throw new Error(
          'mock backend: releaseSave called twice for the same save data'
        )
      }
      released.add(data)
    },
  }
}
