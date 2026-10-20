import { describe, expect, it } from 'vitest'
import { sectorChecksum } from '../../../services/emulator/gen3SaveSlots'
import { bootSaveFor, completeSnapshot, equalBytes } from './arcadeSession'

/** A 128 KiB save whose two slots hold complete saves `counter` and `counter - 1`. */
function save(counter: number): Uint8Array {
  const bytes = new Uint8Array(0x20000).fill(0xff)
  const view = new DataView(bytes.buffer)
  for (const [slot, value] of [
    [counter % 2, counter],
    [(counter + 1) % 2, counter - 1],
  ]) {
    for (let id = 0; id < 14; id++) {
      const offset = slot * 14 * 0x1000 + id * 0x1000
      view.setUint16(offset + 0xff4, id, true)
      view.setUint32(offset + 0xff8, 0x08012025, true)
      view.setUint32(offset + 0xffc, value, true)
      view.setUint16(offset + 0xff6, sectorChecksum(view, offset), true)
    }
  }
  return bytes
}

describe('bootSaveFor', () => {
  it('boots a complete save and reports its counter', () => {
    expect(bootSaveFor(save(4))).toMatchObject({ kind: 'save', saveIndex: 4 })
  })

  it('starts a new game for a missing or blank save', () => {
    expect(bootSaveFor(null)).toEqual({ kind: 'new-game' })
    expect(bootSaveFor(new Uint8Array(0x20000).fill(0xff))).toEqual({
      kind: 'new-game',
    })
  })

  it('refuses partly written and foreign-sized saves', () => {
    const partial = save(4)
    partial[0x10] ^= 1 // corrupt the newest slot's first sector
    expect(bootSaveFor(partial)).toMatchObject({ kind: 'invalid' })
    expect(bootSaveFor(new Uint8Array(0x8000))).toMatchObject({
      kind: 'invalid',
      message: expect.stringContaining('32768 bytes'),
    })
  })
})

describe('session save tracking', () => {
  it('keeps only complete snapshots', () => {
    expect(completeSnapshot(null)).toBeNull()
    expect(completeSnapshot(new Uint8Array(0x20000))).toBeNull()
    expect(completeSnapshot(save(7))?.saveIndex).toBe(7)
  })

  it('compares bytes by value', () => {
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(
      true
    )
    expect(equalBytes(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(
      false
    )
    expect(equalBytes(new Uint8Array([1]), null)).toBe(false)
    expect(equalBytes(null, null)).toBe(true)
  })
})
