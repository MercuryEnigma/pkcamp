import { describe, expect, it } from 'vitest'
import {
  decodeGen3Text,
  extractDirect,
  readGen3RomHeader,
  readRomPointer,
} from './index'

function encodeName(name: string): number[] {
  return [...name.toUpperCase()].map(
    (letter) => 0xbb + letter.charCodeAt(0) - 65
  )
}

describe('Gen III ROM primitives', () => {
  it('identifies the game code and revision', () => {
    const rom = new Uint8Array(0xc0)
    rom.set([...new TextEncoder().encode('BPEE')], 0xac)
    rom[0xbc] = 1
    expect(readGen3RomHeader(rom)).toMatchObject({
      gameId: 'emerald',
      code: 'BPEE',
      revision: 1,
    })
  })

  it('decodes names and bounds GBA pointers to the ROM', () => {
    expect(
      decodeGen3Text(Uint8Array.from([...encodeName('PIKACHU'), 0xff]))
    ).toBe('PIKACHU')
    expect(decodeGen3Text(Uint8Array.from([0xb6, 0xb5, 0x1b, 0xff]))).toBe(
      '♀♂é'
    )
    expect(decodeGen3Text(Uint8Array.from([0xa1, 0xa3, 0xaa, 0xff]))).toBe(
      '029'
    )
    const rom = new Uint8Array(32)
    new DataView(rom.buffer).setUint32(4, 0x08000010, true)
    expect(readRomPointer(rom, 4)).toBe(16)
    new DataView(rom.buffer).setUint32(4, 0x08000040, true)
    expect(readRomPointer(rom, 4)).toBeNull()
  })

  it('extracts a verified vanilla species into the National Dex index', async () => {
    const rom = new Uint8Array(0x330000)
    rom.set(new TextEncoder().encode('BPEE'), 0xac)
    const names = 0x3185c8 + 11
    rom.set(encodeName('BULBASAUR'), names)
    rom[names + 9] = 0xff
    const secondName = 0x3185c8 + 22
    rom.set(encodeName('IVYSAUR'), secondName)
    rom[secondName + 7] = 0xff
    const stats = 0x3203cc + 28
    rom.set([45, 49, 49, 45, 65, 65, 12, 3, 45, 64], stats)
    rom.set([60, 62, 63, 60, 80, 80], 0x3203cc + 2 * 28)
    const firstEvolution = 0x32531c + 40
    new DataView(rom.buffer).setUint16(firstEvolution, 4, true)
    new DataView(rom.buffer).setUint16(firstEvolution + 2, 16, true)
    new DataView(rom.buffer).setUint16(firstEvolution + 4, 2, true)
    const dataset = await extractDirect(rom)
    expect(dataset.species[1]).toMatchObject({
      nationalDexNumber: 1,
      romSpeciesIds: [1],
      name: 'BULBASAUR',
      stats: { hp: 45, attack: 49, defense: 49, speed: 45 },
      types: ['Grass', 'Poison'],
      evolutions: {
        to: [{ nationalDexNumber: 2, method: 'level', parameter: 16 }],
      },
    })
    expect(dataset.species[2].evolutions.from).toEqual([1])
  })

  it('uses HexManiac pointer references for Ruby layouts', async () => {
    const rom = new Uint8Array(0x400000)
    rom.set(new TextEncoder().encode('AXVE'), 0xac)
    const view = new DataView(rom.buffer)
    view.setUint32(0xfa58, 0x08300000, true)
    view.setUint32(0x10b64, 0x08302000, true)
    view.setUint32(0x2e18c, 0x08304000, true)
    view.setUint32(0x9fe64, 0x08306000, true)
    view.setUint32(0x3b7bc, 0x08308000, true)
    view.setUint32(0x3f534, 0x0830a000, true)
    const names = 0x300000 + 11
    rom.set(encodeName('BULBASAUR'), names)
    rom[names + 9] = 0xff
    rom.set([45, 49, 49], 0x302000 + 28)
    const dataset = await extractDirect(rom)
    expect(dataset.game.id).toBe('ruby')
    expect(dataset.species[1].stats.hp).toBe(45)
  })
})
