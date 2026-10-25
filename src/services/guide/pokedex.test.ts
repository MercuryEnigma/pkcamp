import { describe, expect, it } from 'vitest'
import {
  itemNames,
  readHeldItems,
  readPokedexEntries,
  readProfile,
  regionalNumber,
} from './pokedex'

function encode(text: string): number[] {
  return [
    ...[...text].map((letter) =>
      letter === ' ' ? 0x00 : 0xbb + letter.charCodeAt(0) - 65
    ),
    0xff,
  ]
}

function pointer(view: DataView, at: number, target: number) {
  view.setUint32(at, 0x08000000 + target, true)
}

describe('Pokédex tables', () => {
  it('reads Emerald entries by National Dex number', () => {
    const rom = new Uint8Array(0x2000)
    const view = new DataView(rom.buffer)
    const row = 0x100 + 32
    rom.set(encode('SEED'), row)
    view.setUint16(row + 0x0c, 7, true)
    view.setUint16(row + 0x0e, 69, true)
    rom.set(encode('A SEED'), 0x1000)
    pointer(view, row + 0x10, 0x1000)
    const table = readPokedexEntries(rom, 0x100, 'emerald', [1])
    expect(table.status).toBe('available')
    expect(table.entries.get(1)).toEqual({
      category: 'SEED',
      flavorText: ['A SEED'],
      height: 7,
      weight: 69,
    })
  })

  it('keeps both Ruby pages and reports missing rows as partial', () => {
    const rom = new Uint8Array(0x2000)
    const view = new DataView(rom.buffer)
    const row = 0x100 + 36
    rom.set(encode('SEED'), row)
    view.setUint16(row + 0x0c, 7, true)
    view.setUint16(row + 0x0e, 69, true)
    rom.set(encode('PAGE ONE'), 0x1000)
    rom.set(encode('PAGE TWO'), 0x1100)
    pointer(view, row + 0x10, 0x1000)
    pointer(view, row + 0x14, 0x1100)
    const table = readPokedexEntries(rom, 0x100, 'ruby', [1, 2])
    expect(table.entries.get(1)?.flavorText).toEqual(['PAGE ONE', 'PAGE TWO'])
    expect(table.entries.has(2)).toBe(false)
    expect(table.status).toBe('partial')
    expect(readPokedexEntries(rom, undefined, 'ruby', [1]).status).toBe(
      'unavailable'
    )
  })

  it('names items only from a table whose rows carry their own index', () => {
    const rom = new Uint8Array(0x1000)
    for (let id = 1; id <= 10; id++) {
      rom.set(encode('POTION'), 0x100 + id * 44)
      rom[0x100 + id * 44 + 14] = id
    }
    expect(itemNames(rom, 0x100)?.(3)).toBe('POTION')
    rom[0x100 + 5 * 44 + 14] = 0
    expect(itemNames(rom, 0x100)).toBeNull()
  })

  it('reads held items and base-stat metadata from a stats row', () => {
    const row = new Uint8Array(28)
    row.set([139, 0, 202, 0], 12)
    row[18] = 70
    row[19] = 4
    row[24] = 6
    row[25] = 0x82
    const name = (id: number) => (id === 139 ? 'ORAN BERRY' : 'LIGHT BALL')
    expect(readHeldItems(row, name)).toEqual([
      { itemId: 139, name: 'ORAN BERRY', probability: 0.5 },
      { itemId: 202, name: 'LIGHT BALL', probability: 0.05 },
    ])
    row.set([109, 0, 109, 0], 12)
    expect(readHeldItems(row, null)).toEqual([
      { itemId: 109, name: null, probability: 1 },
    ])
    expect(readProfile(row)).toEqual({
      baseFriendship: 70,
      growthRate: 'fast',
      safariFleeRate: 6,
      color: 'yellow',
    })
  })

  it('numbers species in the Hoenn or Kanto Dex', () => {
    const rom = new Uint8Array(0x100)
    expect(regionalNumber(rom, undefined, 'emerald', 277, 252)).toBeNull()
    const hoenn = new Uint8Array(0x400)
    hoenn[0x10 + 276 * 2] = 1
    expect(regionalNumber(hoenn, 0x10, 'emerald', 277, 252)).toBe(1)
    hoenn[0x10] = 203
    expect(regionalNumber(hoenn, 0x10, 'ruby', 1, 1)).toBeNull()
    expect(regionalNumber(rom, undefined, 'firered', 25, 25)).toBe(25)
    expect(regionalNumber(rom, undefined, 'firered', 277, 252)).toBeNull()
  })
})
