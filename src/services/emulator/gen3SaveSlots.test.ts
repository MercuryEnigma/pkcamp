import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { checkGen3Save, sectorChecksum } from './gen3SaveSlots'

const SECTOR = 0x1000
const SLOT = 14 * SECTOR

/** Writes one signed sector holding `id`'s data for save `counter`. */
function writeSector(
  save: Uint8Array,
  offset: number,
  id: number,
  counter: number
): void {
  const view = new DataView(save.buffer)
  for (let i = 0; i < 0xf80; i += 4) {
    view.setUint32(offset + i, (id * 0x01010101 + counter * 7 + i) >>> 0, true)
  }
  view.setUint16(offset + 0xff4, id, true)
  view.setUint32(offset + 0xff8, 0x08012025, true)
  view.setUint32(offset + 0xffc, counter, true)
  view.setUint16(offset + 0xff6, sectorChecksum(view, offset), true)
}

/** Writes a complete save into `slot`, rotated the way the games rotate it. */
function writeSlot(save: Uint8Array, slot: 0 | 1, counter: number): void {
  for (let position = 0; position < 14; position++) {
    writeSector(
      save,
      slot * SLOT + position * SECTOR,
      (position + counter) % 14,
      counter
    )
  }
}

/** Two complete saves: slot 0 holds counter 6, slot 1 holds counter 5. */
function twoSaves(size = 0x20000): Uint8Array {
  const save = new Uint8Array(size).fill(0xff)
  writeSlot(save, 1, 5)
  writeSlot(save, 0, 6)
  return save
}

describe('checkGen3Save', () => {
  it('accepts the newest complete slot and reports its counter', () => {
    const result = checkGen3Save(twoSaves())
    expect(result).toMatchObject({
      status: 'ok',
      newestSlot: 0,
      saveIndex: 6,
      footerBytes: 0,
    })
    expect(result.slots.map((slot) => slot.complete)).toEqual([true, true])
  })

  it('accepts an emulator RTC footer after the 128 KiB image', () => {
    expect(checkGen3Save(twoSaves(0x20010))).toMatchObject({
      status: 'ok',
      footerBytes: 16,
    })
  })

  it('reports a blank save as empty, not committable', () => {
    for (const fill of [0x00, 0xff]) {
      expect(checkGen3Save(new Uint8Array(0x20000).fill(fill))).toMatchObject({
        status: 'empty',
        newestSlot: null,
        saveIndex: null,
      })
    }
  })

  it('refuses a save interrupted partway through writing', () => {
    const save = twoSaves()
    // Save 7 goes into slot 1 (holding save 5) and stops after six sectors.
    for (let position = 0; position < 6; position++) {
      writeSector(save, SLOT + position * SECTOR, (position + 7) % 14, 7)
    }

    const result = checkGen3Save(save)
    expect(result).toMatchObject({
      status: 'incomplete',
      newestSlot: 1,
      saveIndex: 7,
    })
    const slot = result.slots[1]
    expect(slot.complete).toBe(false)
    // Sections 7–12 carry save 7. The shifted rotation overwrote sections 5
    // and 6 of save 5, and the rest still hold save 5.
    expect(slot.missingSections).toEqual([5, 6])
    expect(slot.staleSections).toEqual([0, 1, 2, 3, 4, 13])
    // The older complete save in slot 0 is untouched.
    expect(result.slots[0].complete).toBe(true)
  })

  it('refuses a newest save with a damaged sector', () => {
    const save = twoSaves()
    save[3 * SECTOR + 0x10] ^= 0x01

    const result = checkGen3Save(save)
    expect(result.status).toBe('incomplete')
    expect(result.slots[0].badChecksums).toEqual([(3 + 6) % 14])
  })

  it('reports sections that are missing entirely', () => {
    const save = twoSaves()
    save.fill(0xff, 0, SECTOR)

    const result = checkGen3Save(save)
    expect(result.status).toBe('incomplete')
    expect(result.slots[0].missingSections).toEqual([6])
  })

  it('rejects a 64 KiB image even when its first slot is complete', () => {
    const save = new Uint8Array(0x10000).fill(0xff)
    writeSlot(save, 0, 2)
    expect(checkGen3Save(save).status).toBe('unsupported-size')
  })

  it('rejects sizes that are not a Gen 3 battery save', () => {
    for (const size of [0, 0x8000, 0x1ffff, 0x20000 + 0x31, 0x40000]) {
      expect(checkGen3Save(new Uint8Array(size)).status).toBe(
        'unsupported-size'
      )
    }
  })

  it('reads a subarray at its own offset', () => {
    const save = twoSaves()
    const padded = new Uint8Array(save.length + 8)
    padded.set(save, 8)
    expect(checkGen3Save(padded.subarray(8)).status).toBe('ok')
  })
})

/**
 * Real saves live in the gitignored `src/assets/saves/` (see
 * `pkhexWasmBackend.test.ts`). Only structural results are asserted.
 */
const SAVES = fileURLToPath(new URL('../../assets/saves/', import.meta.url))
const FIXTURES = [
  'emerald.sav',
  'firered.sav',
  'Pokemon Ruby.sav',
  'Pokemon Sapphire.sav',
]
const missing = FIXTURES.filter((name) => !existsSync(SAVES + name))

describe.skipIf(missing.length > 0)(
  `checkGen3Save on real saves${missing.length ? ` — skipped, missing: ${missing.join(', ')}` : ''}`,
  () => {
    it.each(FIXTURES)('finds a complete newest save in %s', (name) => {
      const result = checkGen3Save(new Uint8Array(readFileSync(SAVES + name)))
      expect(result.status).toBe('ok')
      expect(
        result.slots.find((slot) => slot.slot === result.newestSlot)?.complete
      ).toBe(true)
    })
  }
)
