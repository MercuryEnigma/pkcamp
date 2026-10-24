/**
 * Real {@link PokemonSaveBackend} over the vendored `pkhex-wasm` build
 * (`vendor/pkhex-wasm`), which wraps PKHeX.Core compiled to WebAssembly.
 *
 * This replaces the fixture-driven `mockBackend.ts` with actual save parsing.
 * It satisfies the same interface, so `adapter.ts` and everything above it is
 * unchanged.
 *
 * Two notes on the seam:
 *
 * - `initPKHex()` is asynchronous (one-time WASM bootstrap), but every
 *   operation afterwards is synchronous. So the *factory* is async while the
 *   backend's methods stay synchronous, exactly as `backend.ts` specifies.
 * - `PokemonNode` is a lossy, read-only projection: it carries IVs/EVs/moves/
 *   ribbons for display, but no PID, experience, met data, etc., so it
 *   cannot be re-serialized field-by-field into valid `.pkm` bytes. The
 *   backend therefore records each node's file bytes when it produces the node
 *   (via PKHeX.Facade's `Pokemon.ToFile()`, surfaced as `Pokemon.toBytes()`)
 *   and returns those from `exportPokemonFile` — the contract's "only
 *   whole-node import/export is supported".
 *
 * Every read delegates straight through the pkhex-wasm bridge to PKHeX.Facade;
 * the only translation here is shape: enum-ish strings to the adapter's
 * unions, the bridge's positional `null` slots passed through as-is.
 */

import {
  initPKHex,
  type Game,
  type LookupRef,
  type PKHex,
  type Pokemon,
  type StatBlock,
} from 'pkhex-wasm'
import type { BackendSaveData, PokemonSaveBackend } from './backend.ts'
import type {
  BoxNode,
  GameGeneration,
  GameVersion,
  GameVersionIdentity,
  Gender,
  NamedRef,
  PartyNode,
  PokemonNode,
  RibbonRef,
  SaveSlot,
  StatSpread,
} from './types.ts'

/**
 * PKHeX.Core `GameVersion` names → the adapter's exact-game union.
 *
 * PKHeX distinguishes Green (JP) from Blue (intl); the adapter's union has
 * only `Blue`, so both map there. Aggregate names (`RB`, `RBY`, `GS`, `RSE`,
 * …) are deliberately absent: those mean "family, not title" and surface as
 * `exact: 'Unknown'` instead.
 */
const EXACT_VERSION: Record<string, GameVersion> = {
  RD: 'Red',
  GN: 'Blue',
  BU: 'Blue',
  YW: 'Yellow',
  GD: 'Gold',
  SI: 'Silver',
  C: 'Crystal',
  R: 'Ruby',
  S: 'Sapphire',
  E: 'Emerald',
  FR: 'FireRed',
  LG: 'LeafGreen',
  D: 'Diamond',
  P: 'Pearl',
  Pt: 'Platinum',
  HG: 'HeartGold',
  SS: 'SoulSilver',
  B: 'Black',
  W: 'White',
  B2: 'Black2',
  W2: 'White2',
  X: 'X',
  Y: 'Y',
  OR: 'OmegaRuby',
  AS: 'AlphaSapphire',
  SN: 'Sun',
  MN: 'Moon',
  US: 'UltraSun',
  UM: 'UltraMoon',
  GP: 'LetsGoPikachu',
  GE: 'LetsGoEevee',
  SW: 'Sword',
  SH: 'Shield',
  BD: 'BrilliantDiamond',
  SP: 'ShiningPearl',
  PLA: 'LegendsArceus',
  SL: 'Scarlet',
  VL: 'Violet',
}

/**
 * Aggregate names the adapter still treats as one game. Ruby and Sapphire
 * saves share a format with no version byte, so PKHeX.Core reports only `RS`;
 * the two play identically, so either Cabin accepts the pair.
 */
const FAMILY_VERSION: Record<string, { exact: GameVersion; label: string }> = {
  RS: { exact: 'RubySapphire', label: 'Ruby/Sapphire' },
}

/**
 * PKHeX.Core `EntityContext` names → generation number. The lettered contexts
 * are sub-generations: `Gen7b` is LGPE, `Gen8a` PLA, `Gen8b` BDSP, `Gen9a`
 * Legends Z-A.
 */
const GENERATION: Record<string, GameGeneration> = {
  Gen1: 1,
  Gen2: 2,
  Gen3: 3,
  Gen4: 4,
  Gen5: 5,
  Gen6: 6,
  Gen7: 7,
  Gen7b: 7,
  Gen8: 8,
  Gen8a: 8,
  Gen8b: 8,
  Gen9: 9,
  Gen9a: 9,
}

const GENDER: Record<string, Gender> = {
  male: 'Male',
  female: 'Female',
  genderless: 'Genderless',
}

export interface PkhexWasmBackendOptions {
  /**
   * Base URL the WASM runtime fetches `_framework` assets from.
   *
   * Defaults to the location the Vite plugin in `vite.config.ts` publishes
   * them to, derived from `import.meta.env.BASE_URL` so it is correct in dev
   * and in a based production build alike.
   */
  wasmBaseUrl?: string
  /** Inject an already-initialized root (tests, or sharing one runtime). */
  pkhex?: PKHex
}

/** Where `vite.config.ts`'s `pkhexWasmAssets()` plugin serves the runtime. */
export function defaultWasmBaseUrl(): string | undefined {
  // Vite injects BASE_URL; outside a Vite pipeline (plain Node) there is none,
  // and the package's own module-relative default is correct.
  const base = import.meta.env?.BASE_URL
  return typeof base === 'string'
    ? `${base}pkhex-wasm/wasm/_framework/`
    : undefined
}

function versionIdentity(game: Game): GameVersionIdentity {
  const generation = GENERATION[game.generation] ?? 3
  const family = FAMILY_VERSION[game.saveVersion]
  if (family) {
    return {
      exact: family.exact,
      approximateGeneration: generation,
      aggregated: family.label,
    }
  }
  // `isVersionAggregated` means PKHeX.Core itself stored only a family (Gen 1
  // saves carry no version byte at all, so Red/Blue/Yellow are one value).
  if (game.isVersionAggregated) {
    return {
      exact: 'Unknown',
      approximateGeneration: generation,
      aggregated: `Gen ${generation} (approximate)`,
    }
  }
  const exact = EXACT_VERSION[game.saveVersion] ?? 'Unknown'
  return {
    exact,
    approximateGeneration: generation,
    aggregated: exact === 'Unknown' ? `Gen ${generation} (approximate)` : exact,
  }
}

function toSpread(block: StatBlock): StatSpread {
  return {
    hp: block.health,
    attack: block.attack,
    defense: block.defense,
    specialAttack: block.specialAttack,
    specialDefense: block.specialDefense,
    speed: block.speed,
  }
}

function toRef(ref: LookupRef | null): NamedRef | null {
  return ref === null ? null : { id: ref.id, name: ref.name }
}

function toNode(mon: Pokemon): PokemonNode {
  return {
    species: mon.species.id,
    form: mon.form,
    level: mon.level,
    gender: GENDER[mon.gender] ?? 'Genderless',
    shiny: mon.isShiny,
    isEgg: mon.isEgg,
    nickname: mon.nickname,
    originalTrainerName: mon.owner.name,
    // Facade Pokemon.Id: the displayed ID, not the save trainer's.
    originalTrainerId: mon.ownerDisplayId.tid,
    originalTrainerSecretId: mon.ownerDisplayId.sid,
    heldItem: mon.heldItem,
    heldItemName: mon.heldItemName,
    nature: toRef(mon.nature),
    ability: toRef(mon.ability),
    // Move id 0 is PKHeX's empty-slot sentinel; the node uses positional null.
    moves: mon.moves.map(({ move, pp }) =>
      move.id === 0 ? null : { id: move.id, name: move.name, pp }
    ),
    ribbons: mon.ribbons.map((ribbon): RibbonRef => ({
      id: ribbon.id,
      name: ribbon.name,
      shortName: ribbon.shortName,
      iconFile: ribbon.iconFile,
    })),
    ivs: toSpread(mon.ivs),
    evs: toSpread(mon.evs),
    // `battleStats` (Facade Pokemon.BaseStats — computed, recomputed for boxed
    // entities), not v1 `stats`, which reads zeros for boxed entities.
    stats: toSpread(mon.battleStats),
  }
}

/**
 * Creates the real backend. Boots the WASM runtime once; the returned
 * backend's methods are all synchronous.
 */
export async function createPkhexWasmBackend(
  options: PkhexWasmBackendOptions = {}
): Promise<PokemonSaveBackend> {
  const wasmBaseUrl = options.wasmBaseUrl ?? defaultWasmBaseUrl()
  const pkhex =
    options.pkhex ??
    (await initPKHex(wasmBaseUrl ? { wasmBaseUrl } : undefined))

  /** Live save handles, so releaseSave() can dispose the right one. */
  const games = new WeakMap<BackendSaveData, Game>()
  /**
   * Original `.pkm` bytes per node produced by this backend. `PokemonNode` is
   * lossy, so faithful export has to go back to the bytes we read.
   */
  const originBytes = new WeakMap<PokemonNode, Uint8Array>()

  /** Projects one slot, remembering its bytes for a later export. */
  const slotOf = (mon: Pokemon | null): SaveSlot => {
    if (mon === null) return null
    const node = toNode(mon)
    originBytes.set(node, mon.toBytes())
    return node
  }

  return {
    loadSave(bytes: Uint8Array): BackendSaveData {
      const game = pkhex.load(bytes)
      try {
        const party: PartyNode = game.partySlots().map(slotOf)

        const boxes: BoxNode[] = []
        for (let i = 0; i < game.boxCount; i++) {
          boxes.push({
            name: game.boxName(i),
            slots: game.boxSlots(i).map(slotOf),
          })
        }

        const data: BackendSaveData = {
          trainer: {
            name: game.trainer.name,
            id: game.trainer.id.tid,
            secretId: game.trainer.id.sid,
          },
          party,
          boxes,
          version: versionIdentity(game),
        }
        games.set(data, game)
        return data
      } catch (cause) {
        // Never leak the WASM-side save when projection fails partway.
        game.dispose()
        throw cause
      }
    },

    loadPokemonFile(bytes: Uint8Array): PokemonNode {
      // Facade's Pokemon.LoadFrom: standalone, no owning save, not converted.
      const mon = pkhex.parsePkm(bytes)
      try {
        const node = toNode(mon)
        // Facade's ToFile() re-serializes in the party layout .pk* files use,
        // so this is byte-identical to a party-format input.
        originBytes.set(node, mon.toBytes())
        return node
      } finally {
        // The node is plain data now; the handle would otherwise be retained
        // by the WASM registry for the lifetime of the runtime.
        mon.release()
      }
    },

    exportPokemonFile(pokemon: PokemonNode): Uint8Array {
      const bytes = originBytes.get(pokemon)
      if (!bytes) {
        throw new Error(
          'pkhex-wasm backend: cannot export a PokemonNode this backend did not produce — ' +
            'PokemonNode carries no PID/experience/met data, so valid .pkm bytes cannot be ' +
            'reconstructed from it. Export nodes obtained from loadSave() or loadPokemonFile().'
        )
      }
      // Fresh copy per call: callers must not be able to mutate our record.
      return bytes.slice()
    },

    setBoxSlot(data, location, pokemon): void {
      const game = games.get(data)
      if (!game)
        throw new Error('pkhex-wasm backend: cannot edit a disposed save')
      if (pokemon === null) {
        game.setBoxSlot(location.box, location.slot, null)
        return
      }
      const bytes = originBytes.get(pokemon)
      if (!bytes) {
        throw new Error(
          'pkhex-wasm backend: cannot place a PokemonNode this backend did not produce'
        )
      }
      const mon = pkhex.parsePkm(bytes)
      try {
        game.setBoxSlot(location.box, location.slot, mon)
      } finally {
        mon.release()
      }
    },

    saveBytes(data: BackendSaveData): Uint8Array {
      const game = games.get(data)
      if (!game)
        throw new Error('pkhex-wasm backend: cannot serialize a disposed save')
      return pkhex.saveBytes(game).slice()
    },

    releaseSave(data: BackendSaveData): void {
      // Idempotent: Game.dispose() is itself safe to call twice, and dropping
      // the entry means a repeat call is a no-op.
      const game = games.get(data)
      if (!game) return
      games.delete(data)
      game.dispose()
    },
  }
}
