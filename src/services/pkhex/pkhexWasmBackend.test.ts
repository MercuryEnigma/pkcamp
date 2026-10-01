/// <reference types="node" />
/**
 * Real-backend tests: these boot the actual WASM build from
 * `vendor/pkhex-wasm/dist` and parse real Gen 3 save files.
 *
 * Fixtures live in `src/assets/saves/`, which is gitignored because it holds
 * personal save data. Assertions here are deliberately limited to *structural*
 * facts (exact game, slot counts, which slots are occupied, byte round-trips)
 * — never trainer names, IDs, or species, so nothing personal is recorded in
 * the repo or in test output.
 *
 * When the fixtures are absent (a fresh clone, CI) the suite skips rather than
 * failing, and the skip reason names the missing files.
 */

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import {
  initializePokemonSaveAdapter,
  type PokemonSaveAdapter,
} from './adapter.ts'
import type { PokemonSaveBackend } from './backend.ts'
import { createPkhexWasmBackend } from './pkhexWasmBackend.ts'
import type { SaveGame } from './types.ts'

const SAVES = fileURLToPath(new URL('../../assets/saves/', import.meta.url))
/** Runtime assets of the vendored build, addressed on disk for Node. */
const WASM_BASE_URL = new URL(
  '../../../vendor/pkhex-wasm/dist/wasm/_framework/',
  import.meta.url
).href

const FIXTURES = {
  emerald: `${SAVES}emerald.sav`,
  firered: `${SAVES}firered.sav`,
  pk3: `${SAVES}ribbondol.pk3`,
}

const missing = Object.entries(FIXTURES)
  .filter(([, path]) => !existsSync(path))
  .map(([name]) => name)

const read = (path: string): Uint8Array => new Uint8Array(readFileSync(path))

describe.skipIf(missing.length > 0)(
  `pkhex-wasm real backend (Gen 3 fixtures)${missing.length ? ` — skipped, missing: ${missing.join(', ')}` : ''}`,
  () => {
    let backend: PokemonSaveBackend
    let adapter: PokemonSaveAdapter
    const opened: SaveGame[] = []

    beforeAll(async () => {
      backend = await createPkhexWasmBackend({ wasmBaseUrl: WASM_BASE_URL })
      adapter = initializePokemonSaveAdapter({ backend })
    })

    afterAll(() => {
      for (const game of opened) game.dispose()
    })

    /** Loads a fixture and registers it for cleanup. */
    const load = (path: string): SaveGame => {
      const game = adapter.load(read(path))
      opened.push(game)
      return game
    }

    describe('exact game identity', () => {
      it('identifies Emerald exactly, not just "Gen 3"', () => {
        const game = load(FIXTURES.emerald)
        expect(game.version.exact).toBe('Emerald')
        expect(game.version.approximateGeneration).toBe(3)
        expect(game.version.aggregated).toBe('Emerald')
      })

      it('identifies FireRed exactly, distinguishing it from Emerald', () => {
        const game = load(FIXTURES.firered)
        expect(game.version.exact).toBe('FireRed')
        expect(game.version.approximateGeneration).toBe(3)
      })

      it('gives the two saves different exact versions despite one generation', () => {
        const emerald = load(FIXTURES.emerald)
        const firered = load(FIXTURES.firered)
        expect(emerald.version.approximateGeneration).toBe(
          firered.version.approximateGeneration
        )
        expect(emerald.version.exact).not.toBe(firered.version.exact)
      })
    })

    describe('positional box data', () => {
      it('exposes all 14 Gen 3 boxes with 30 positional slots each', () => {
        const game = load(FIXTURES.emerald)
        expect(game.boxes).toHaveLength(14)
        for (const box of game.boxes) {
          expect(box.slots).toHaveLength(30)
          expect(box.name.length).toBeGreaterThan(0)
        }
      })

      it('preserves empty slots as null instead of omitting them', () => {
        const game = load(FIXTURES.emerald)
        // The fixture's first box is partially filled, which is exactly the
        // case the old `box()` accessor destroyed by compacting the array.
        const slots = game.boxes[0].slots
        const empty = slots.filter((slot) => slot === null)
        const occupied = slots.filter((slot) => slot !== null)

        expect(occupied.length).toBeGreaterThan(0)
        expect(empty.length).toBeGreaterThan(0)
        expect(occupied.length + empty.length).toBe(30)
      })

      it('keeps occupied Pokemon at their own slot indices', () => {
        const game = load(FIXTURES.emerald)
        const slots = game.boxes[0].slots
        // Positional means index identity is meaningful: a compacted array
        // could not satisfy both of these at once.
        const firstOccupied = slots.findIndex((slot) => slot !== null)
        expect(firstOccupied).toBeGreaterThanOrEqual(0)
        expect(slots[firstOccupied]).not.toBeNull()
      })

      it('exposes the party as six positional slots', () => {
        const game = load(FIXTURES.firered)
        expect(game.party).toHaveLength(6)
        expect(game.party.filter(Boolean).length).toBeGreaterThan(0)
        // Every entry is either a Pokemon node or an explicit empty slot.
        for (const slot of game.party) {
          expect(slot === null || typeof slot.species === 'number').toBe(true)
        }
      })
    })

    describe('form and egg state', () => {
      it('reports form and isEgg on real entities', () => {
        const game = load(FIXTURES.emerald)
        const mons = game.boxes
          .flatMap((box) => box.slots)
          .filter((s) => s !== null)
        expect(mons.length).toBeGreaterThan(0)

        for (const mon of mons) {
          expect(typeof mon.form).toBe('number')
          expect(mon.form).toBeGreaterThanOrEqual(0)
          expect(typeof mon.isEgg).toBe('boolean')
          // Sanity: these are the fields that were entirely absent before.
          expect(typeof mon.species).toBe('number')
          expect(typeof mon.heldItem).toBe('number')
        }
      })
    })

    describe('detail fields (nature, ability, moves, IVs/EVs, stats, OT id)', () => {
      /** Every occupied slot across both saves: party + all boxes. */
      const everyMon = () =>
        [load(FIXTURES.emerald), load(FIXTURES.firered)].flatMap((game) =>
          [...game.party, ...game.boxes.flatMap((box) => box.slots)].filter(
            (s) => s !== null
          )
        )

      it('reads the standalone .pk3 exactly (Baltoy, Lv 17, Bashful, Levitate)', () => {
        // Species/nature/ability/move/stat values are ordinary game data.
        const node = adapter.importPokemonFile(read(FIXTURES.pk3))
        expect(node.species).toBe(343)
        expect(node.level).toBe(17)
        expect(node.nature).toEqual({ id: 18, name: 'Bashful' })
        expect(node.ability).toEqual({ id: 26, name: 'Levitate' })
        expect(node.moves.map((m) => m?.name)).toEqual([
          'Rock Tomb',
          'Refresh',
          'Mud-Slap',
          'Psybeam',
        ])
        expect(node.ivs).toEqual({
          hp: 17,
          attack: 29,
          defense: 31,
          specialAttack: 29,
          specialDefense: 2,
          speed: 19,
        })
        expect(node.evs).toEqual({
          hp: 0,
          attack: 0,
          defense: 0,
          specialAttack: 0,
          specialDefense: 0,
          speed: 0,
        })
        // Independently checked against the Gen 3 formula with Baltoy's base
        // stats (40/40/55/40/70/55), Lv 17, neutral nature, the IVs above:
        // HP floor((80+17)*17/100)+17+10 = 43, others floor(...)+5.
        expect(node.stats).toEqual({
          hp: 43,
          attack: 23,
          defense: 28,
          specialAttack: 23,
          specialDefense: 29,
          speed: 26,
        })
        expect(node.heldItem).toBe(0)
        expect(node.heldItemName).toBe('')
      })

      it('reads the National ribbon on the standalone .pk3 (chosen because it carries one)', () => {
        const node = adapter.importPokemonFile(read(FIXTURES.pk3))
        // Core's RibbonIndex.National = 23; this ribbon exists in the modern
        // set, so it resolves to that real id rather than the -1/legacy fallback.
        expect(node.ribbons).toEqual([
          {
            id: 23,
            name: 'National',
            shortName: 'National',
            iconFile: 'ribbonnational.png',
          },
        ])
      })

      it('reads an empty ribbon list for Pokemon that have none', () => {
        // Fresh detached/boxed entities in these fixtures generally carry no
        // ribbons; assert the shape holds (array, never null/undefined) even
        // when it's empty.
        for (const mon of everyMon()) {
          expect(Array.isArray(mon.ribbons)).toBe(true)
        }
      })

      it('computes stats for boxed Pokemon, which store none on disk', () => {
        // Regression guard: the v1 `stats` export reads zeros for boxed
        // entities; the node uses Facade's recomputed battle stats instead.
        for (const game of [load(FIXTURES.emerald), load(FIXTURES.firered)]) {
          const boxed = game.boxes
            .flatMap((box) => box.slots)
            .filter((s) => s !== null)
          expect(boxed.length).toBeGreaterThan(0)
          for (const mon of boxed) {
            expect(mon.stats.hp).toBeGreaterThanOrEqual(
              mon.level + 10 > 11 ? 1 : 1
            )
            for (const value of Object.values(mon.stats))
              expect(value).toBeGreaterThan(0)
          }
        }
      })

      it('gives every Gen 3 Pokemon a named nature and ability', () => {
        for (const mon of everyMon()) {
          expect(mon.nature).not.toBeNull()
          expect(mon.nature!.id).toBeGreaterThanOrEqual(0)
          expect(mon.nature!.id).toBeLessThan(25)
          expect(mon.nature!.name.length).toBeGreaterThan(0)
          expect(mon.ability).not.toBeNull()
          expect(mon.ability!.id).toBeGreaterThan(0)
          expect(mon.ability!.name.length).toBeGreaterThan(0)
        }
      })

      it('keeps four positional move slots with names and PP', () => {
        for (const mon of everyMon()) {
          expect(mon.moves).toHaveLength(4)
          expect(mon.moves.some((m) => m !== null)).toBe(true)
          for (const move of mon.moves) {
            if (move === null) continue
            expect(move.id).toBeGreaterThan(0)
            expect(move.name.length).toBeGreaterThan(0)
            expect(move.pp).toBeGreaterThanOrEqual(0)
          }
        }
      })

      it('keeps IVs and EVs within Gen 3 bounds', () => {
        for (const mon of everyMon()) {
          const ivs = Object.values(mon.ivs)
          const evs = Object.values(mon.evs)
          expect(ivs).toHaveLength(6)
          for (const iv of ivs) expect(iv).toBeGreaterThanOrEqual(0)
          for (const iv of ivs) expect(iv).toBeLessThanOrEqual(31)
          for (const ev of evs) expect(ev).toBeGreaterThanOrEqual(0)
          for (const ev of evs) expect(ev).toBeLessThanOrEqual(255)
          expect(evs.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(510)
        }
      })

      it('names every held item from the Gen 3 item table', () => {
        const holding = everyMon().filter((mon) => mon.heldItem !== 0)
        expect(holding.length).toBeGreaterThan(0)
        for (const mon of holding) {
          expect(mon.heldItemName.length).toBeGreaterThan(0)
          // Facade's fallback for an id outside the table.
          expect(mon.heldItemName).not.toMatch(/^Unknown Item/)
        }
        for (const mon of everyMon().filter((m) => m.heldItem === 0)) {
          expect(mon.heldItemName).toBe('')
        }
      })

      it("reads each Pokemon's own OT id, distinct from the save's trainer for traded ones", () => {
        // Values are personal: assert only range and that some differ.
        const game = load(FIXTURES.emerald)
        const mons = [
          ...game.party,
          ...game.boxes.flatMap((box) => box.slots),
        ].filter((s) => s !== null)
        for (const mon of mons) {
          expect(Number.isInteger(mon.originalTrainerId)).toBe(true)
          expect(mon.originalTrainerId).toBeGreaterThanOrEqual(0)
          expect(mon.originalTrainerId).toBeLessThanOrEqual(0xffff)
        }
        expect(
          mons.some((mon) => mon.originalTrainerId !== game.trainer.id)
        ).toBe(true)
      })
    })

    describe('dispose', () => {
      it('is safe to call more than once', () => {
        const game = adapter.load(read(FIXTURES.emerald))
        expect(() => {
          game.dispose()
          game.dispose()
          game.dispose()
        }).not.toThrow()
      })
    })

    describe('single-.pkm import/export', () => {
      it('imports a standalone .pk3 file', () => {
        const node = adapter.importPokemonFile(read(FIXTURES.pk3))
        expect(node.species).toBeGreaterThan(0)
        expect(typeof node.form).toBe('number')
        expect(typeof node.isEgg).toBe('boolean')
        expect(node.level).toBeGreaterThan(0)
      })

      it('round-trips the exact .pk3 bytes back out (Facade LoadFrom -> ToFile)', () => {
        const original = read(FIXTURES.pk3)
        const node = adapter.importPokemonFile(original)
        const exported = adapter.exportPokemonFile(node)
        expect(Array.from(exported)).toEqual(Array.from(original))
      })

      it('returns a fresh buffer per export, not a shared reference', () => {
        const node = adapter.importPokemonFile(read(FIXTURES.pk3))
        const first = adapter.exportPokemonFile(node)
        const second = adapter.exportPokemonFile(node)
        expect(first).not.toBe(second)
        first[0] ^= 0xff
        expect(Array.from(second)).toEqual(
          Array.from(adapter.exportPokemonFile(node))
        )
      })

      it('exports a Pokemon read out of a real save', () => {
        const game = load(FIXTURES.emerald)
        const mon = game.boxes
          .flatMap((box) => box.slots)
          .find((s) => s !== null)!
        const bytes = adapter.exportPokemonFile(mon)
        // Facade's ToFile() writes the party layout: 100 bytes for a Gen 3 PK3,
        // the same shape as a real .pk3 file (like the ribbondol.pk3 fixture).
        expect(bytes.length).toBe(100)
        expect(bytes.length).toBe(read(FIXTURES.pk3).length)
      })

      it('rejects exporting a node it never produced, rather than emitting junk', () => {
        // PokemonNode carries no PID/experience/met data, so valid bytes cannot
        // be reconstructed from a hand-built node; failing loudly is the contract.
        const zero = {
          hp: 0,
          attack: 0,
          defense: 0,
          specialAttack: 0,
          specialDefense: 0,
          speed: 0,
        }
        expect(() =>
          adapter.exportPokemonFile({
            species: 25,
            form: 0,
            level: 5,
            gender: 'Male',
            shiny: false,
            isEgg: false,
            nickname: 'PIKACHU',
            originalTrainerName: 'RED',
            originalTrainerId: 0,
            heldItem: 0,
            heldItemName: '',
            nature: null,
            ability: null,
            moves: [null, null, null, null],
            ribbons: [],
            ivs: zero,
            evs: zero,
            stats: zero,
          })
        ).toThrow(/did not produce/i)
      })

      it('places an imported Pokemon into a box slot positionally', () => {
        const game = load(FIXTURES.emerald)
        const node = adapter.importPokemonFile(read(FIXTURES.pk3))
        const box = game.boxes[0]
        const emptyIndex = box.slots.findIndex((slot) => slot === null)
        expect(emptyIndex).toBeGreaterThanOrEqual(0)

        const updated = adapter.placeInBox(box, emptyIndex, node)
        expect(updated.slots[emptyIndex]).toBe(node)
        expect(updated.slots).toHaveLength(30)
        // The original box is untouched (adapter returns a new box).
        expect(box.slots[emptyIndex]).toBeNull()
      })
    })

    describe('box movement and save serialization', () => {
      it('moves to an empty slot, clears the source, and persists both changes', () => {
        const game = load(FIXTURES.emerald)
        const sourceBox = game.boxes.findIndex((box) =>
          box.slots.some((slot) => slot !== null)
        )
        const sourceSlot = game.boxes[sourceBox].slots.findIndex(
          (slot) => slot !== null
        )
        const destinationBox = game.boxes.findIndex((box) =>
          box.slots.some((slot) => slot === null)
        )
        const destinationSlot = game.boxes[destinationBox].slots.findIndex(
          (slot) => slot === null
        )
        const species = game.boxes[sourceBox].slots[sourceSlot]!.species

        game.movePokemon(
          { box: sourceBox, slot: sourceSlot },
          { box: destinationBox, slot: destinationSlot }
        )
        expect(game.boxes[sourceBox].slots[sourceSlot]).toBeNull()
        expect(game.boxes[destinationBox].slots[destinationSlot]?.species).toBe(
          species
        )

        const reloaded = adapter.load(game.toBytes())
        opened.push(reloaded)
        expect(reloaded.boxes[sourceBox].slots[sourceSlot]).toBeNull()
        expect(
          reloaded.boxes[destinationBox].slots[destinationSlot]?.species
        ).toBe(species)
      })

      it('writes an imported standalone Pokémon through setBoxSlot', () => {
        const game = load(FIXTURES.emerald)
        const imported = adapter.importPokemonFile(read(FIXTURES.pk3))
        const destinationBox = game.boxes.findIndex((box) =>
          box.slots.some((slot) => slot === null)
        )
        const destinationSlot = game.boxes[destinationBox].slots.findIndex(
          (slot) => slot === null
        )

        game.setBoxSlot(
          { box: destinationBox, slot: destinationSlot },
          imported
        )
        const reloaded = adapter.load(game.toBytes())
        opened.push(reloaded)
        expect(
          reloaded.boxes[destinationBox].slots[destinationSlot]?.species
        ).toBe(imported.species)
      })
    })

    describe('trainer data', () => {
      it('reads structural trainer fields', () => {
        const game = load(FIXTURES.emerald)
        // Values themselves are personal; assert only shape/ranges.
        expect(typeof game.trainer.name).toBe('string')
        expect(Number.isInteger(game.trainer.id)).toBe(true)
        expect(game.trainer.id).toBeGreaterThanOrEqual(0)
        expect(game.trainer.id).toBeLessThanOrEqual(0xffff)
        expect(Number.isInteger(game.trainer.secretId)).toBe(true)
      })
    })
  }
)
