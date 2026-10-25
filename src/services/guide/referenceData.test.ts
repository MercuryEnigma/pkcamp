import { describe, expect, it } from 'vitest'
import { extractDirect } from './extractor'

function encode(text: string): number[] {
  return [...text]
    .map((letter) =>
      letter === ' '
        ? 0
        : /[0-9]/.test(letter)
          ? 0xa1 + Number(letter)
          : 0xbb + letter.charCodeAt(0) - 65
    )
    .concat(0xff)
}

function fixture() {
  const bytes = new Uint8Array(0x420000)
  const view = new DataView(bytes.buffer)
  const ptr = (offset: number, target: number) =>
    view.setUint32(offset, 0x08000000 + target, true)
  bytes.set(new TextEncoder().encode('BPEE'), 0xac)
  bytes.fill(0xff, 0x3185c8, 0x3185c8 + 412 * 11)
  for (const [id, name] of [
    [1, 'BULBASAUR'],
    [4, 'CHARMANDER'],
    [13, 'WEEDLE'],
    [14, 'KAKUNA'],
    [15, 'BEEDRILL'],
  ] as const) {
    bytes.set(encode(name), 0x3185c8 + id * 11)
    bytes.set([45, 49, 49, 45, 65, 65, 12, 3], 0x3203cc + id * 28)
  }
  for (let id = 1; id <= 354; id++)
    bytes.set(encode(`MOVE${id}`), 0x31977c + id * 13)
  const tables = {
    egg: 0x400000,
    machines: 0x401000,
    compatibility: 0x402000,
    wild: 0x404000,
    banks: 0x405000,
    names: 0x406000,
  }
  const anchors = {
    'data.pokemon.moves.egg': tables.egg,
    'data.pokemon.moves.tms': tables.machines,
    'data.pokemon.moves.tmcompatibility': tables.compatibility,
    'data.pokemon.wild': tables.wild,
    'data.maps.banks': tables.banks,
    'data.maps.names': tables.names,
  }
  const metadata = Object.entries(anchors)
    .map(
      ([name, address]) =>
        `[[NamedAnchors]]\nName = '''${name}'''\nAddress = ${address}\n`
    )
    .join('\n')
  ;[20001, 1, 2, 20004, 3, 0xffff].forEach((value, index) =>
    view.setUint16(tables.egg + index * 2, value, true)
  )
  for (let slot = 0; slot < 58; slot++)
    view.setUint16(tables.machines + slot * 2, slot + 1, true)
  for (const slot of [0, 49, 50, 57])
    bytes[tables.compatibility + 8 + (slot >> 3)] |= 1 << (slot & 7)
  const wild = tables.wild
  bytes.set([0, 1], wild)
  bytes.set([0xff, 0xff], wild + 20)
  ptr(tables.banks, 0x407000)
  ptr(0x407004, 0x408000)
  bytes[0x408000 + 20] = 5
  ptr(tables.names + 5 * 8 + 4, 0x409000)
  bytes.set(encode('ROUTE 1'), 0x409000)
  for (let kind = 0; kind < 4; kind++) {
    const info = 0x40a000 + kind * 16
    const slots = 0x40a100 + kind * 64
    ptr(wild + 4 + kind * 4, info)
    view.setUint32(info, 20, true)
    ptr(info + 4, slots)
    const species =
      kind === 0
        ? [13, 13, 14, 14, 15, 15, 13, 14, 15, 13, 14, 15]
        : kind === 1
          ? Array(5).fill(13)
          : kind === 2
            ? Array(5).fill(15)
            : [13, 13, 14, 14, 14, 15, 15, 15, 15, 15]
    species.forEach((id, index) => {
      bytes.set([3, 5], slots + index * 4)
      view.setUint16(slots + index * 4 + 2, id, true)
    })
  }
  return { bytes, metadata, view, tables }
}

describe('ROM reference tables', () => {
  it('decodes species markers and machine bit positions without mixing ROM species with move IDs', async () => {
    const { bytes, metadata } = fixture()
    const data = await extractDirect(bytes, { metadata })
    expect(data.capabilities).toMatchObject({
      eggMoves: 'available',
      tmHm: 'available',
      encounters: 'available',
    })
    expect(data.species[1].learnsets.egg.map((move) => move.romId)).toEqual([
      1, 2,
    ])
    expect(data.species[4].learnsets.egg.map((move) => move.romId)).toEqual([3])
    expect(data.species[13].learnsets.egg).toEqual([])
    expect(
      data.species[1].learnsets.tmHm.map((move) => [move.romId, move.machine])
    ).toEqual([
      [1, { kind: 'tm', number: 1 }],
      [50, { kind: 'tm', number: 50 }],
      [51, { kind: 'hm', number: 1 }],
      [58, { kind: 'hm', number: 8 }],
    ])
  })

  it('resolves ROM map names and aggregates slots into conditional probabilities and National Dex indexes', async () => {
    const { bytes, metadata } = fixture()
    const data = await extractDirect(bytes, { metadata })
    expect(data.locations['0.1']).toEqual([13, 14, 15])
    expect(
      data.species[13].encounters.find((row) => row.method === 'grass')
    ).toMatchObject({
      mapName: 'ROUTE 1',
      mapId: '0.1',
      probability: 0.49,
      encounterRate: 20,
      minLevel: 3,
      maxLevel: 5,
    })
    expect(
      data.species[14].encounters.find((row) => row.method === 'grass')
        ?.probability
    ).toBe(0.26)
    expect(
      data.species[15].encounters.find((row) => row.method === 'grass')
        ?.probability
    ).toBe(0.25)
    expect(
      data.species[13].encounters.find((row) => row.method === 'surf')
        ?.probability
    ).toBe(1)
    expect(
      data.species[15].encounters.find((row) => row.method === 'rock-smash')
        ?.probability
    ).toBe(1)
    for (const [id, method] of [
      [13, 'old-rod'],
      [14, 'good-rod'],
      [15, 'super-rod'],
    ] as const)
      expect(
        data.species[id].encounters.find((row) => row.method === method)
          ?.probability
      ).toBe(1)
  })

  it('keeps alternate wild tables conditional and does not double their chances or location indexes', async () => {
    const { bytes, metadata, tables } = fixture()
    bytes.copyWithin(tables.wild + 20, tables.wild, tables.wild + 20)
    bytes.set([0xff, 0xff], tables.wild + 40)
    const data = await extractDirect(bytes, { metadata })
    const grass = data.species[13].encounters.filter(
      (row) => row.method === 'grass'
    )
    expect(grass).toHaveLength(2)
    expect(grass.map((row) => row.probability)).toEqual([0.49, 0.49])
    expect(grass[1].conditions).toEqual(['alternate-encounter-table:1'])
    expect(data.locations['0.1']).toEqual([13, 14, 15])
  })

  it('marks damaged optional tables partial while retaining the supported species data', async () => {
    const { bytes, metadata, view, tables } = fixture()
    view.setUint32(tables.wild + 4, 0x02000000, true)
    const data = await extractDirect(bytes, { metadata })
    expect(data.species[1].name).toBe('BULBASAUR')
    expect(data.capabilities.encounters).toBe('partial')
    expect(
      data.species[13].encounters.some((row) => row.method === 'grass')
    ).toBe(false)
    expect(
      data.species[13].encounters.some((row) => row.method === 'surf')
    ).toBe(true)
    expect(data.warnings).toContainEqual({
      code: 'partial-data',
      detail: 'wild-encounters',
    })
  })

  it('distinguishes unavailable tables from a verified empty learnset', async () => {
    const { bytes } = fixture()
    const data = await extractDirect(bytes)
    expect(data.capabilities).toMatchObject({
      eggMoves: 'unavailable',
      tmHm: 'unavailable',
      encounters: 'unavailable',
    })
    expect(data.species[1].learnsets.egg).toEqual([])
  })
})
