import { describe, expect, it } from 'vitest'
import { childrenOf, isWithin, MemoryFileStore } from './fileStore'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('childrenOf', () => {
  const paths = [
    'settings.json',
    'saves/ruby/ruby.gba',
    'saves/ruby/2026-01-01/current.sav',
    'saves/ruby/2026-01-02/current.sav',
    'saves/rubyx/rubyx.gba',
  ]

  it('lists root children', () => {
    expect(childrenOf(paths, '')).toEqual([
      { name: 'settings.json', kind: 'file' },
      { name: 'saves', kind: 'folder' },
    ])
  })

  it('lists files and de-duplicated folders', () => {
    expect(childrenOf(paths, 'saves/ruby')).toEqual([
      { name: 'ruby.gba', kind: 'file' },
      { name: '2026-01-01', kind: 'folder' },
      { name: '2026-01-02', kind: 'folder' },
    ])
  })

  it('does not match sibling folders sharing a prefix', () => {
    expect(childrenOf(paths, 'saves/rubyx')).toEqual([
      { name: 'rubyx.gba', kind: 'file' },
    ])
    expect(childrenOf(paths, 'saves/rub')).toEqual([])
  })

  it('is empty for a missing folder', () => {
    expect(childrenOf(paths, 'camp')).toEqual([])
  })
})

describe('isWithin', () => {
  it('matches the path itself and descendants only', () => {
    expect(isWithin('saves/ruby', 'saves/ruby')).toBe(true)
    expect(isWithin('saves/ruby/a.sav', 'saves/ruby')).toBe(true)
    expect(isWithin('saves/rubyx/a.sav', 'saves/ruby')).toBe(false)
    expect(isWithin('saves', 'saves/ruby')).toBe(false)
  })
})

describe('MemoryFileStore', () => {
  it('round trips bytes and modified time', async () => {
    const store = new MemoryFileStore()
    const modified = new Date('2026-03-04T05:06:07Z')
    await store.write('a/b.bin', bytes(1, 2, 3), modified)
    const file = await store.read('a/b.bin')
    expect(Array.from(file!.bytes)).toEqual([1, 2, 3])
    expect(file!.modified).toEqual(modified)
    expect(await store.read('a/missing')).toBeNull()
  })

  it('copies bytes on write and read', async () => {
    const store = new MemoryFileStore()
    const input = bytes(1, 2)
    await store.write('f', input)
    input[0] = 9
    const first = await store.read('f')
    first!.bytes[1] = 9
    expect(Array.from((await store.read('f'))!.bytes)).toEqual([1, 2])
  })

  it('deletes a folder recursively without touching prefix siblings', async () => {
    const store = new MemoryFileStore()
    await store.write('saves/ruby/a/current.sav', bytes(1))
    await store.write('saves/ruby/ruby.gba', bytes(2))
    await store.write('saves/rubyx/rubyx.gba', bytes(3))
    await store.delete('saves/ruby')
    expect(await store.list('saves')).toEqual([
      { name: 'rubyx', kind: 'folder' },
    ])
  })

  it('deleting a missing path is fine', async () => {
    const store = new MemoryFileStore()
    await expect(store.delete('nope')).resolves.toBeUndefined()
  })

  it('lists immediate children', async () => {
    const store = new MemoryFileStore()
    await store.write('x/a', bytes(1))
    await store.write('x/y/b', bytes(1))
    expect(await store.list('x')).toEqual([
      { name: 'a', kind: 'file' },
      { name: 'y', kind: 'folder' },
    ])
    expect(await store.list('missing')).toEqual([])
  })
})
